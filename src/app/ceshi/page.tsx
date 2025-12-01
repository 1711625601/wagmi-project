"use client";

import { useEffect, useMemo, useState } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useSignTypedData,
} from "wagmi";
import { type Address, type Abi, formatUnits, parseUnits } from "viem";

import AAATokenJson from "./abi/AAAToken.json";
import AAAStakingJson from "./abi/AAAStaking.json";

const AAATOKEN_ADDRESS: Address = "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707";
const AAASTAKING_ADDRESS: Address =
  "0x0165878A594ca255338adfa4d48449f69242Eb8F";

const TOKEN_ABI = AAATokenJson.abi as unknown as Abi;
const STAKING_ABI = AAAStakingJson.abi as unknown as Abi;

export default function CeshiPage() {
  const { address, chainId, status } = useAccount();

  const [stakeInput, setStakeInput] = useState<string>("");

  const decimalsData = useReadContract({
    abi: TOKEN_ABI,
    address: AAATOKEN_ADDRESS,
    functionName: "decimals",
  }).data as number | undefined;
  const decimals = decimalsData ?? 18;

  const { data: symbolData } = useReadContract({
    abi: TOKEN_ABI,
    address: AAATOKEN_ADDRESS,
    functionName: "symbol",
  });
  const symbol =
    (typeof symbolData === "string" ? symbolData : undefined) ?? "AAA";

  const { data: balanceData } = useReadContract({
    abi: TOKEN_ABI,
    address: AAATOKEN_ADDRESS,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address), refetchInterval: 2000 },
  });
  const balance = (
    typeof balanceData === "bigint" ? balanceData : 0n
  ) as bigint;

  const { data: allowanceData } = useReadContract({
    abi: TOKEN_ABI,
    address: AAATOKEN_ADDRESS,
    functionName: "allowance",
    args: address ? [address, AAASTAKING_ADDRESS] : undefined,
    query: { enabled: Boolean(address), refetchInterval: 2000 },
  });
  const allowance = (
    typeof allowanceData === "bigint" ? allowanceData : 0n
  ) as bigint;

  const { data: stakedData } = useReadContract({
    abi: STAKING_ABI,
    address: AAASTAKING_ADDRESS,
    functionName: "stakes",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address), refetchInterval: 2000 },
  });
  const stakedAmount = (
    typeof stakedData === "bigint" ? stakedData : 0n
  ) as bigint;

  const {
    writeContract: writeToken,
    data: approveHash,
    isPending: isApproving,
    error: approveError,
  } = useWriteContract();
  const {
    writeContract: writeTokenReset,
    data: approveZeroHash,
    isPending: isResetting,
    error: approveZeroError,
  } = useWriteContract();
  const {
    writeContract: writeStaking,
    data: stakeHash,
    isPending: isStaking,
    error: stakeError,
  } = useWriteContract();
  const {
    data: withdrawHash,
    isPending: isWithdrawing,
    writeContract: writeWithdraw,
  } = useWriteContract();

  const { isSuccess: approved } = useWaitForTransactionReceipt({
    hash: approveHash,
  });
  const { isSuccess: approvedZero } = useWaitForTransactionReceipt({
    hash: approveZeroHash,
  });
  const { isSuccess: staked } = useWaitForTransactionReceipt({
    hash: stakeHash,
  });
  const { isSuccess: withdrew } = useWaitForTransactionReceipt({
    hash: withdrawHash,
  });

  const formattedBalance = useMemo(
    () => formatUnits(balance as bigint, Number(decimals)),
    [balance, decimals]
  );
  const formattedStaked = useMemo(
    () => formatUnits(stakedAmount as bigint, Number(decimals)),
    [stakedAmount, decimals]
  );

  const canStake = Boolean(address) && stakeInput !== "";
  const stakeAmount = canStake ? parseUnits(stakeInput, Number(decimals)) : 0n;
  const hasAllowance = allowance >= stakeAmount;
  const isApprovingAll = isApproving || isResetting;

  const onApprove = () => {
    if (!address || stakeInput === "") return;
    writeTokenReset({
      abi: TOKEN_ABI,
      address: AAATOKEN_ADDRESS,
      functionName: "approve",
      args: [AAASTAKING_ADDRESS, 0n],
    });
  };

  useEffect(() => {
    if (approvedZero) {
      writeToken({
        abi: TOKEN_ABI,
        address: AAATOKEN_ADDRESS,
        functionName: "approve",
        args: [AAASTAKING_ADDRESS, stakeAmount],
      });
    }
  }, [approvedZero, stakeAmount, writeToken]);

  const onStake = () => {
    if (!address || stakeInput === "") return;
    writeStaking({
      abi: STAKING_ABI,
      address: AAASTAKING_ADDRESS,
      functionName: "stake",
      args: [stakeAmount],
    });
  };

  const { signTypedDataAsync } = useSignTypedData();
  const { data: nonceData } = useReadContract({
    abi: TOKEN_ABI,
    address: AAATOKEN_ADDRESS,
    functionName: "nonces",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });
  const nonce = (typeof nonceData === "bigint" ? nonceData : 0n) as bigint;
  const { data: nameData } = useReadContract({
    abi: TOKEN_ABI,
    address: AAATOKEN_ADDRESS,
    functionName: "name",
  });
  const tokenName = (
    typeof nameData === "string" ? nameData : "AAAToken"
  ) as string;
  const splitSignature = (sig: `0x${string}`) => {
    const r = sig.slice(0, 66) as `0x${string}`;
    const s = ("0x" + sig.slice(66, 130)) as `0x${string}`;
    const v = parseInt(sig.slice(130, 132), 16);
    return { v, r, s };
  };
  const {
    data: permitHash,
    isPending: isPermitting,
    writeContract: writePermit,
  } = useWriteContract();
  const { isSuccess: permitted } = useWaitForTransactionReceipt({
    hash: permitHash,
  });

  const onPermit = async () => {
    if (!address || stakeInput === "" || !chainId) return;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
    const signature = await signTypedDataAsync({
      domain: {
        name: tokenName,
        version: "1",
        chainId,
        verifyingContract: AAATOKEN_ADDRESS,
      },
      types: {
        Permit: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
          { name: "value", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      },
      primaryType: "Permit",
      message: {
        owner: address,
        spender: AAASTAKING_ADDRESS,
        value: stakeAmount,
        nonce,
        deadline,
      },
    });
    const { v, r, s } = splitSignature(signature as `0x${string}`);
    writePermit({
      abi: TOKEN_ABI,
      address: AAATOKEN_ADDRESS,
      functionName: "permit",
      args: [address, AAASTAKING_ADDRESS, stakeAmount, deadline, v, r, s],
    });
  };

  const onWithdrawAll = () => {
    if (!address || stakedAmount === 0n) return;
    writeWithdraw({
      abi: STAKING_ABI,
      address: AAASTAKING_ADDRESS,
      functionName: "withdraw",
      args: [stakedAmount],
    });
  };

  return (
    <div style={{ padding: 24, display: "grid", gap: 16 }}>
      <h2>本地质押测试（链: {chainId ?? "未连接"}）</h2>
      <div>
        <div>钱包状态: {status}</div>
        <div>地址: {address ?? "未连接"}</div>
      </div>

      <div>
        <div>代币: {symbol}</div>
        <div>余额: {formattedBalance}</div>
        <div>已质押: {formattedStaked}</div>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          placeholder="输入质押数量"
          value={stakeInput}
          onChange={(e) => setStakeInput(e.target.value)}
          style={{ padding: 8, width: 240 }}
        />
        <button onClick={onApprove} disabled={!canStake || isApprovingAll}>
          {isApprovingAll ? "授权中..." : "授权 AAAStaking"}
        </button>
        <button onClick={onPermit} disabled={!canStake || isPermitting}>
          {isPermitting ? "签名授权中..." : "签名授权 (permit)"}
        </button>
        <button
          onClick={onStake}
          disabled={!canStake || (!hasAllowance && !approved) || isStaking}
        >
          {isStaking ? "质押中..." : "质押"}
        </button>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={onWithdrawAll}
          disabled={!address || isWithdrawing || stakedAmount === 0n}
        >
          {isWithdrawing ? "提现中..." : "全部提现"}
        </button>
      </div>

      <div style={{ fontSize: 12, color: "#999" }}>
        <div>AAAToken: {AAATOKEN_ADDRESS}</div>
        <div>AAAStaking: {AAASTAKING_ADDRESS}</div>
        <div>decimals: {decimals}</div>
        <div>allowance: {String(allowance)}</div>
        <div>stakeInput: {stakeInput}（人类单位）</div>
        <div>stakeAmount: {String(stakeAmount)}（区块链最小单位）</div>
        <div style={{ color: "#d00" }}>
          {approveError?.message ||
            approveZeroError?.message ||
            stakeError?.message ||
            ""}
        </div>
      </div>
    </div>
  );
}
