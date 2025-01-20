import { HardhatUserConfig, vars } from "hardhat/config"
import "@nomicfoundation/hardhat-toolbox"

const INFURA_API_KEY = vars.get("INFURA_API_KEY")
const GBTCL_PK = vars.get("GBTCL_PK")
const ETHERSCAN_API_KEY = vars.get("ETHERSCAN_API_KEY")

const config: HardhatUserConfig = {
  solidity: "0.8.28",
  networks: {
    sepolia: {
      url: `https://sepolia.infura.io/v3/${INFURA_API_KEY}`,
      accounts: [GBTCL_PK]
    },  
  },
  etherscan: {
    apiKey: {
      sepolia: ETHERSCAN_API_KEY
    }
  }
}

export default config
