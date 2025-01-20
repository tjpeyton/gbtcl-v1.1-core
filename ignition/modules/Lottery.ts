import { buildModule } from "@nomicfoundation/hardhat-ignition/modules"
import { vars } from "hardhat/config"

const LINK_VRF_SUB_ID = vars.get("LINK_VRF_SUB_ID")
const SEPOLIA_LINK_VRF_KEY_HASH = vars.get("SEPOLIA_LINK_VRF_KEY_HASH")

const RANDOM_WORDS_CALLBACK_GAS_LIMIT = 1000000
const RANDOM_WORDS_REQUEST_CONFIRMATIONS = 3
const RANDOM_WORDS_NUM_WORDS = 1  


const LotteryModule = buildModule("LotteryModule", (m) => {
  const subscriptionId = m.getParameter("subscriptionId", LINK_VRF_SUB_ID)
  const keyHash = m.getParameter("keyHash", SEPOLIA_LINK_VRF_KEY_HASH)
  const callbackGasLimit = m.getParameter(
    "callbackGasLimit", RANDOM_WORDS_CALLBACK_GAS_LIMIT
  )
  const requestConfirmations = m.getParameter(
    "requestConfirmations", RANDOM_WORDS_REQUEST_CONFIRMATIONS
  )
  const numWords = m.getParameter("numWords", RANDOM_WORDS_NUM_WORDS)

  const lottery = m.contract("Lottery", [
    subscriptionId, keyHash, callbackGasLimit, requestConfirmations, numWords  
  ])

  return { lottery }
})

export default LotteryModule
