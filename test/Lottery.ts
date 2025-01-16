import LotteryModule from "../ignition/modules/Lottery"
import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers"
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
  import hre from "hardhat"

const CHAINLINK_VRF_SUBSCRIPTION_ID 
  = 10983783455360127594871918987558559356853137173816231575871871199253308714605

const SEPOLIA_CHAINLINK_VRF_KEY_HASH 
  = "0x787d74caea10b2b357790d5b5247c2f63d1d91572a9846f780606e4d953677ae" 

const RANDOM_WORDS_CALLBACK_GAS_LIMIT = 1000000
const RANDOM_WORDS_REQUEST_CONFIRMATIONS = 3
const RANDOM_WORDS_NUM_WORDS = 1  

describe("Lottery", function () {

  async function deployLotteryFixture() {
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

    return { lottery, subscriptionId, owner, otherAccount }
  }


  describe("Deployment", function () {

    it("Should set the right operator", async function () {
      const { lottery, owner } = await loadFixture(deployLotteryFixture)
      expect(await lottery.getOperator()).to.equal(owner.address)
    })
  })

  describe("Lottery", function () {
    it("Should create a lottery", async function () {
      const { lottery, owner } = await loadFixture(deployLotteryFixture)
      
    })
  })  
})    
