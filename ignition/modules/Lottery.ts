import { buildModule } from "@nomicfoundation/hardhat-ignition/modules"

const CHAINLINK_VRF_SUBSCRIPTION_ID 
  = 10983783455360127594871918987558559356853137173816231575871871199253308714605

const SEPOLIA_CHAINLINK_VRF_KEY_HASH 
  = "0x787d74caea10b2b357790d5b5247c2f63d1d91572a9846f780606e4d953677ae" 

const RANDOM_WORDS_CALLBACK_GAS_LIMIT = 1000000
const RANDOM_WORDS_REQUEST_CONFIRMATIONS = 3
const RANDOM_WORDS_NUM_WORDS = 1  


const LotteryModule = buildModule("LotteryModule", (m) => {
  const subscriptionId = m.getParameter("subscriptionId", CHAINLINK_VRF_SUBSCRIPTION_ID)
  const keyHash = m.getParameter("keyHash", SEPOLIA_CHAINLINK_VRF_KEY_HASH)
  const callbackGasLimit = m.getParameter("callbackGasLimit", RANDOM_WORDS_CALLBACK_GAS_LIMIT)
  const requestConfirmations = m.getParameter("requestConfirmations", RANDOM_WORDS_REQUEST_CONFIRMATIONS)
  const numWords = m.getParameter("numWords", RANDOM_WORDS_NUM_WORDS)

  const lottery = m.contract("Lottery", [
    subscriptionId, keyHash, callbackGasLimit, requestConfirmations, numWords  
  ])

  return { lottery }
})

export default LotteryModule
