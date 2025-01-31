import { ethers } from "ethers"
import { useEffect, useMemo, useState } from "react"

import L1_erc20ABI from "@/assets/abis/L1_erc20ABI.json"
import { GATEWAY_ROUTE_PROXY_ADDR, WETH_GATEWAY_PROXY_ADDR, WETH_SYMBOL } from "@/constants"
import { useApp } from "@/contexts/AppContextProvider"
import { useRainbowContext } from "@/contexts/RainbowProvider"
import { amountToBN } from "@/utils"

const useApprove = (fromNetwork, selectedToken, amount) => {
  const { walletCurrentAddress, chainId } = useRainbowContext()
  const { networksAndSigners } = useApp()

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const [isNeeded, setIsNeeded] = useState(false)

  const approveAddress = useMemo(() => {
    if (!fromNetwork.isL1 && selectedToken.symbol === WETH_SYMBOL) return WETH_GATEWAY_PROXY_ADDR[fromNetwork.chainId]
    return GATEWAY_ROUTE_PROXY_ADDR[fromNetwork.chainId]
  }, [fromNetwork, selectedToken])

  const tokenInstance = useMemo(() => {
    if (networksAndSigners[chainId as number]?.signer && !selectedToken.native) {
      return new ethers.Contract((selectedToken as ERC20Token).address, L1_erc20ABI, networksAndSigners[chainId as number].signer)
    }
    return null
  }, [selectedToken, networksAndSigners[chainId as number]])

  const checkApproval = async (token, amount) => {
    try {
      if (!tokenInstance) {
        return false
      }
      const parsedAmount = amountToBN(amount, token.decimals)
      const approvedAmount = await tokenInstance.allowance(walletCurrentAddress, approveAddress)
      if (approvedAmount >= parsedAmount) {
        return false
      }
      return true
    } catch (err) {
      return false
    }
  }

  useEffect(() => {
    if ((selectedToken as NativeToken).native || !tokenInstance) {
      setIsNeeded(false)
    }
    checkApproval(selectedToken, amount).then(needApproval => {
      setIsNeeded(needApproval)
    })
  }, [selectedToken, amount, approveAddress, tokenInstance])

  const approve = async () => {
    if (!tokenInstance) {
      return
    }
    setIsLoading(true)
    try {
      const tx = await tokenInstance.approve(approveAddress, ethers.MaxUint256)
      await tx?.wait()
      const needApproval = await checkApproval(selectedToken, amount)
      setIsNeeded(needApproval)
    } catch (error) {
      setError(error)
    } finally {
      setIsLoading(false)
    }
  }

  // TODO: test
  const cancelApproval = async () => {
    const tx = await tokenInstance?.approve(approveAddress, 0)
    await tx?.wait()
    const needApproval = await checkApproval(selectedToken, amount)
    setIsNeeded(needApproval)
  }

  return { approve, isNeeded, isLoading, error, cancelApproval }
}

export default useApprove
