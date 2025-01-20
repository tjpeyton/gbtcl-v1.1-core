import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers"
import { expect } from "chai"
import hre from "hardhat"


const CHAINLINK_VRF_SUBSCRIPTION_ID 
  = "10983783455360127594871918987558559356853137173816231575871871199253308714605" 

const SEPOLIA_CHAINLINK_VRF_KEY_HASH 
  = "0x787d74caea10b2b357790d5b5247c2f63d1d91572a9846f780606e4d953677ae" 

const RANDOM_WORDS_CALLBACK_GAS_LIMIT = 1000000
const RANDOM_WORDS_REQUEST_CONFIRMATIONS = 3
const RANDOM_WORDS_NUM_WORDS = 1  

const TICKET_PRICE_IN_WEI = "100"
const MAX_TICKETS = "100"
const OPERATOR_COMMISSION_PERCENTAGE = "10"

const get10MinuteExpiration = () => {  
  return Math.floor(Date.now() / 1000) + 600
} 

const get5SecondExpiration = () => {
  return Math.floor(Date.now() / 1000) + 5
} 


describe("Lottery", function () {

  async function deployLotteryContractFixture() {
    const subscriptionId = CHAINLINK_VRF_SUBSCRIPTION_ID
    const keyHash = SEPOLIA_CHAINLINK_VRF_KEY_HASH
    const callbackGasLimit = RANDOM_WORDS_CALLBACK_GAS_LIMIT
    const requestConfirmations = RANDOM_WORDS_REQUEST_CONFIRMATIONS
    const numWords = RANDOM_WORDS_NUM_WORDS
    // Contracts are deployed using the first signer/account by default
    const [owner, otherAccount] = await hre.ethers.getSigners();

    const Lottery = await hre.ethers.getContractFactory("Lottery")
    const lottery = await Lottery.deploy(
      subscriptionId, keyHash, callbackGasLimit, requestConfirmations, numWords
    )

    return { lottery, owner, otherAccount }
  }


  describe("Contract Deployment", function () {

    it("Should set the right operator", async function () {
      const { lottery, owner } = await loadFixture(deployLotteryContractFixture)
      expect(await lottery.getOperator()).to.equal(owner.address)
    })

    it("Should not allow a non-operator to call the getLotteryBalance function", async function () {
      const { lottery, otherAccount } = await loadFixture(deployLotteryContractFixture)
      await expect(lottery.connect(otherAccount).getLotteryBalance()).to.be.reverted
    })  
  })

  describe("Lottery Creation", function () {

    it("Should create a lottery", async function () {
      const { lottery } = await loadFixture(deployLotteryContractFixture)

      await lottery.addListener(
        "LotteryCreated",
        (
          ticketPrice: number,
          maxTickets: number, 
          operatorCommissionPercentage: number, 
          expiration: number,
          lotteryId: number
        ) => {
          expect(ticketPrice).to.equal(TICKET_PRICE_IN_WEI)
          expect(maxTickets).to.equal(MAX_TICKETS)
          expect(operatorCommissionPercentage).to.equal(OPERATOR_COMMISSION_PERCENTAGE)
          expect(expiration).to.equal(expiration)
          expect(lotteryId).to.equal(1)
        }
      )

      const expiration = get10MinuteExpiration()
      await expect(
        lottery.createLottery(
          TICKET_PRICE_IN_WEI, 
          MAX_TICKETS, 
          OPERATOR_COMMISSION_PERCENTAGE, 
          expiration
        )
      ).to.emit(lottery, "LotteryCreated")

      const lotteryId = await lottery.lotteryCount()
      expect(lotteryId).to.be.equal(1)        

      const lotteryData = await lottery.getLotteryData(lotteryId)
      expect(lotteryData.ticketPrice).to.equal(TICKET_PRICE_IN_WEI)
      expect(lotteryData.maxTickets).to.equal(MAX_TICKETS)
      expect(lotteryData.operatorCommissionPercentage).to.equal(OPERATOR_COMMISSION_PERCENTAGE)
      expect(lotteryData.expiration).to.equal(expiration)
      expect(lotteryData.tickets.length).to.equal(0)  
    })

    it("Should only allow the operator to create a lottery", async function () {
      const { lottery, otherAccount } = await loadFixture(deployLotteryContractFixture)

      await expect(
        lottery.connect(otherAccount).createLottery(
          TICKET_PRICE_IN_WEI, 
          MAX_TICKETS, 
          OPERATOR_COMMISSION_PERCENTAGE, 
          get10MinuteExpiration()
        )).to.be.reverted
    })
  })

  describe("Lottery Ticket Purchase", function () { 

    it("Should allow a user to purchase a ticket", async function () {
      const { lottery, otherAccount, owner } = await loadFixture(deployLotteryContractFixture)

      await lottery.createLottery(
        TICKET_PRICE_IN_WEI, 
        MAX_TICKETS, 
        OPERATOR_COMMISSION_PERCENTAGE, 
        get10MinuteExpiration()
      )
      const lotteryId = await lottery.lotteryCount()
      
      await lottery.addListener(
        "TicketsBought",
        (
          buyer: string,
          lotteryId: number,
          ticketsBought: number
        ) => {
          expect(buyer).to.equal(otherAccount.address)
          expect(lotteryId).to.equal(1)
          expect(ticketsBought).to.equal(1)
        }
      ) 
      
      await expect(
        lottery.connect(otherAccount).purchaseTickets(
          lotteryId, 
          1,
          { value: TICKET_PRICE_IN_WEI }  
        )
      ).to.emit(lottery, "TicketsBought") 

      const lotteryData = await lottery.getLotteryData(lotteryId)
      expect(lotteryData.tickets.length).to.equal(1)
      expect(lotteryData.tickets[0]).to.equal(otherAccount.address)
      
      const ticketsRemaining = await lottery.getRemainingTickets(lotteryId)
      expect(ticketsRemaining).to.equal(Number(MAX_TICKETS) - 1)  

      const lotteryBalance = await lottery.connect(owner).getLotteryBalance()
      expect(lotteryBalance).to.equal(TICKET_PRICE_IN_WEI)  
    }) 

    it("Should not allow a user to purchase 0 tickets", async function () {
      const { lottery } = await loadFixture(deployLotteryContractFixture)
      await expect(lottery.purchaseTickets(1, 0)).to.be.reverted
    })
    
    it("Should not allow a user to purchase a ticket with invalid ether value", async function () {
      const { lottery } = await loadFixture(deployLotteryContractFixture)
      await lottery.createLottery(
        TICKET_PRICE_IN_WEI, 
        MAX_TICKETS, 
        OPERATOR_COMMISSION_PERCENTAGE, 
        get10MinuteExpiration()
      )

      const lotteryId = await lottery.lotteryCount() 
      
      await expect(
        lottery.purchaseTickets(
          lotteryId, 
          1
        )
      ).to.be.revertedWith(
        "Error: Ether value must be equal to number of tickets times ticket price"
      )   

      await expect(
        lottery.purchaseTickets(
          lotteryId, 
          1,
          { value: 50 }
        )
      ).to.be.revertedWith(
        "Error: Ether value must be equal to number of tickets times ticket price"
      )

      await expect(
        lottery.purchaseTickets(
          lotteryId, 
          2,
          { value: 150 }
        )
      ).to.be.revertedWith(
        "Error: Ether value must be equal to number of tickets times ticket price"
      )
    })

    it("Should not allow a user to purchase more tickets than the lottery has remaining", async function () {
      const { lottery } = await loadFixture(deployLotteryContractFixture)
      await lottery.createLottery(TICKET_PRICE_IN_WEI, MAX_TICKETS, OPERATOR_COMMISSION_PERCENTAGE, get10MinuteExpiration())

      await expect(
        lottery.purchaseTickets(
          1, 
          101
        )
      ).to.be.revertedWith(
        "Error: Number of tickets must be less than or equal to remaining tickets"
      ) 
    })

    it("Should not allow a user to purchase tickets after the lottery has expired", async function () {
      const { lottery } = await loadFixture(deployLotteryContractFixture)
      await lottery.createLottery(TICKET_PRICE_IN_WEI, MAX_TICKETS, OPERATOR_COMMISSION_PERCENTAGE, get5SecondExpiration())

      await time.increaseTo(get5SecondExpiration() + 1)

      await expect(
        lottery.purchaseTickets(1, 1, { value: TICKET_PRICE_IN_WEI })
      ).to.be.revertedWith("Error: Lottery is no longer active")
    })
  })
})    
