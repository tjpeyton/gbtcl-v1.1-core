// SPDX-License-Identifier: MIT
pragma solidity >=0.5.0 <=0.8.26;

import "@openzeppelin/contracts/utils/Strings.sol";
import {VRFConsumerBaseV2Plus} from "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import {VRFV2PlusClient} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";

contract Lottery is VRFConsumerBaseV2Plus {
    address public operator;
    uint256 public lotteryCount = 0;
    
    // Chainlink VRF subscription ID
    uint256 public s_subscriptionId;

    // Sepolia testnet gas lane
    bytes32 public keyHash =
        0x787d74caea10b2b357790d5b5247c2f63d1d91572a9846f780606e4d953677ae;

    // fullfillRandomWords - this is fine for 1 word
    uint32 public callbackGasLimit = 1000000;
    uint16 public requestConfirmations = 3;
    uint32 public numWords = 1;

    struct LotteryData {
        uint256 ticketPrice;
        uint256 maxTickets;
        uint256 operatorCommissionPercentage;
        uint256 expiration;
        address lotteryWinner;
        address[] tickets;
    }

    struct LotteryStatus {
        uint256 lotteryId;
        bool fulfilled; 
        bool exists;
        uint256[] randomWords;
    }

    mapping(uint256 => LotteryStatus) public requests; /* requestId --> lotteryStatus */
    mapping(uint256 => LotteryData) public lottery; /* lotteryId --> lotteryData */

    event LotteryCreated(
        uint256 ticketPrice,
        uint256 maxTickets,
        uint256 operatorCommissionPercentage,
        uint256 expiration,
        uint256 lotteryId
    );

    event LogTicketCommission(
        uint256 lotteryId,
        address lotteryOperator,
        uint256 amount
    );

    event TicketsBought(
        address buyer,
        uint256 lotteryId,
        uint256 ticketsBought
    );

    event LotteryWinnerRequestSent(
        uint256 lotteryId,
        uint256 requestId,
        uint32 numWords
    );

    event RequestFulfilled(uint256 requestId, uint256[] randomWords);

    event LotteryWinnerDrawn(uint256 lotteryId, address lotteryWinner);

    event LotteryClaimed(
        uint256 lotteryId,
        address lotteryWinner,
        uint256 amount
    );

    constructor(
      uint256 _subscriptionId, 
      bytes32 _keyHash, 
      uint32 _callbackGasLimit, 
      uint16 _requestConfirmations, 
      uint32 _numWords
    ) 
        VRFConsumerBaseV2Plus(0x9DdfaCa8183c41ad55329BdeeD9F6A8d53168B1B) {
            operator = msg.sender;
            s_subscriptionId = _subscriptionId;
            keyHash = _keyHash;
            callbackGasLimit = _callbackGasLimit;
            requestConfirmations = _requestConfirmations;
            numWords = _numWords;
    }

    modifier onlyOperator() {
        require(msg.sender == operator);
        _;
    }

    function getOperator() public view returns (address) {
        return operator;
    }

    function getLotteryData(uint256 _lotteryId) public view returns (LotteryData memory) {
        return lottery[_lotteryId];
    }

    function getLotteryStatus(uint256 _requestId) public onlyOperator view returns (LotteryStatus memory) {
        return requests[_requestId];
    }

    function getRemainingTickets(uint256 _lotteryId) public view returns (uint256) {
        return lottery[_lotteryId].maxTickets - lottery[_lotteryId].tickets.length;
    }

    function getLotteryExpiration(uint256 _lotteryId) public view returns (uint256) {
        return lottery[_lotteryId].expiration;
    }

    function getLotteryBalance() external view returns (uint balance) {
        return address(this).balance;
    }

    function getVRFRequestStatus(
        uint256 _requestId
    ) external view returns (bool exists, bool fulfilled, uint256[] memory randomWords) {
        require(requests[_requestId].exists, "request not found");

        LotteryStatus memory request = requests[_requestId];
        return (request.exists, request.fulfilled, request.randomWords);
    }

    function createLottery(
        uint256 _ticketPriceInWei,
        uint256 _maxTickets,
        uint256 _operatorCommissionPercentage,
        uint256 _expiration
    ) public onlyOperator returns (uint lotteryId) {
        require(
            (_operatorCommissionPercentage >= 0 && _operatorCommissionPercentage % 5 == 0),
            "Error: Commission percentage should be greater than zero and multiple of 5"
        );
        require(
            _expiration > block.timestamp,
            "Error: Expiration must be greater than current block timestamp"
        );
        require(_maxTickets > 0, "Error: Max tickets must be greater than 0");
        require(_ticketPriceInWei > 0, "Error: Ticket price must be greater than 0");

        address[] memory ticketsArray;
        lotteryCount++;
        lottery[lotteryCount] = LotteryData({
            ticketPrice: _ticketPriceInWei,
            maxTickets: _maxTickets,
            operatorCommissionPercentage: _operatorCommissionPercentage,
            expiration: _expiration,
            lotteryWinner: address(0),
            tickets: ticketsArray
        });
        emit LotteryCreated(
            _ticketPriceInWei,
            _maxTickets,
            _operatorCommissionPercentage,
            _expiration,
            lotteryCount
        );

        return lotteryCount;
    }

    function purchaseTickets(uint256 _lotteryId, uint256 _tickets) public payable {
        uint256 amount = msg.value;
        require(
            _tickets > 0,
            "Error: Number of tickets must be greater than 0"
        );
        require(
            _tickets <= getRemainingTickets(_lotteryId),
            "Error: Number of tickets must be less than or equal to remaining tickets"
        );
        require(
            amount >= _tickets * lottery[_lotteryId].ticketPrice,
            "Error: Ether value must be equal to number of tickets times ticket price"
        );
        require(
            block.timestamp < lottery[_lotteryId].expiration,
            "Error: Lottery is no longer active"
        );

        LotteryData storage currentLottery = lottery[_lotteryId];

        for (uint i = 0; i < _tickets; i++) {
            currentLottery.tickets.push(msg.sender);
        }

        emit TicketsBought(msg.sender, _lotteryId, _tickets);
    }

    // Assumes the subscription is funded sufficiently.
    // @param enableNativePayment: Set to `true` to enable payment in native tokens, or
    // `false` to pay in LINK
    function drawWinner(
        uint256 _lotteryId, 
        bool _enableNativePayment
    ) public onlyOperator returns (uint256 requestId) {
        require(
            block.timestamp > lottery[_lotteryId].expiration,
            "Error: Lottery has not yet expired"
        );
        require(
            lottery[_lotteryId].lotteryWinner == address(0),
            "Error: Lottery winner already drawn"
        );
        // Request a random number using Chainlink VRF
        // Will revert if subscription is not set and funded.
        requestId = s_vrfCoordinator.requestRandomWords(
            VRFV2PlusClient.RandomWordsRequest({
                keyHash: keyHash,
                subId: s_subscriptionId,
                requestConfirmations: requestConfirmations,
                callbackGasLimit: callbackGasLimit,
                numWords: numWords,
                extraArgs: VRFV2PlusClient._argsToBytes(
                    VRFV2PlusClient.ExtraArgsV1({
                        nativePayment: _enableNativePayment
                    })
                )
            })
        );

        requests[requestId] = LotteryStatus({
            lotteryId: _lotteryId,
            randomWords: new uint256[](0),
            exists: true,
            fulfilled: false
        });

        emit LotteryWinnerRequestSent(_lotteryId, requestId, numWords);
        return requestId; 
    }

    // called by Chainlink vrf with the requested random words
    // Determine lottery winner
    function fulfillRandomWords(
        uint256 _requestId,
        uint256[] calldata _randomWords
    ) internal override {
        require(requests[_requestId].exists, "request not found");

        requests[_requestId].fulfilled = true;
        requests[_requestId].randomWords = _randomWords;

        // Provide a storage instance of the current Lottery being drawn
        uint256 lotteryId = requests[_requestId].lotteryId;
        LotteryData storage currentLottery = lottery[lotteryId];

        // Determine a random index and choose winner
        uint256 winnerIndex = _randomWords[0] % currentLottery.tickets.length;
        currentLottery.lotteryWinner = currentLottery.tickets[winnerIndex];

        // Amount of eth allocated to this particular lottery
        uint256 vaultAmount = currentLottery.tickets.length *
            currentLottery.ticketPrice;

        // eth held for operators
        uint256 operatorCommission = vaultAmount /
            (100 / currentLottery.operatorCommissionPercentage);

        // send commision to operator
        (bool sentCommission, ) = payable(operator).call{
            value: operatorCommission
        }("");

        require(sentCommission);

        emit LogTicketCommission(
            lotteryId,
            operator,
            operatorCommission
        );

        uint256 winnerAmount = vaultAmount - operatorCommission;

        (bool sentWinner, ) = payable(currentLottery.lotteryWinner).call{
            value: winnerAmount
        }("");

        require(sentWinner);

        emit LotteryClaimed(
            lotteryId,
            currentLottery.lotteryWinner,
            winnerAmount
        );

        emit RequestFulfilled(_requestId, _randomWords);
    }
}
