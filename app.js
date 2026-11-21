import { BANK_ADDRESS, READ_RPC_URL, STUDENT_ID, STUDENT_NAME } from "./config.js";

const SEPOLIA = 11155111n;
const ABI = [
  "function deposit() payable",
  "function withdraw(uint256 amount)",
  "function checkBlance() view returns (uint256)"
];

const byId = (id) => document.getElementById(id);
const connect = byId("connect");
const check = byId("check");
const deposit = byId("deposit");
const withdraw = byId("withdraw");
const balance = byId("balance");
const status = byId("status");
const transaction = byId("transaction");
byId("student-id").textContent = STUDENT_ID || "กรอกรหัสใน config.js";
byId("student-name").textContent = STUDENT_NAME || "กรอกชื่อใน config.js";

async function start() {
  const { BrowserProvider, Contract, JsonRpcProvider, isAddress, formatEther, parseEther } =
    await import("https://cdn.jsdelivr.net/npm/ethers@6.15.0/+esm");

  const injected = window.ethereum;
  const wallet = injected?.providers?.find((provider) => provider.isMetaMask) ?? injected;
  const readRpc = READ_RPC_URL ? new JsonRpcProvider(READ_RPC_URL, SEPOLIA) : null;
  let session = null;
  let busy = false;
  let walletRevision = 0;

  function updateButtons() {
    connect.disabled = busy || !wallet;
    for (const button of [check, deposit, withdraw]) {
      button.disabled = busy || !session;
    }
  }

  function reset(message) {
    session = null;
    balance.textContent = "—";
    byId("account").textContent = "";
    status.textContent = message;
    updateButtons();
  }

  async function run(action) {
    busy = true;
    updateButtons();
    try {
      await action();
    } catch (error) {
      status.textContent = error.code === 4001 || error.code === "ACTION_REJECTED"
        ? "ยกเลิกรายการใน MetaMask"
        : error.reason || error.shortMessage || error.message;
    } finally {
      busy = false;
      updateButtons();
    }
  }

  async function readBalance(active) {
    const override = { from: active.account };
    let value;
    if (readRpc) {
      try {
        // checkBlance ใช้ msg.sender จึงต้องระบุบัญชีใน eth_call
        value = await active.contract.connect(readRpc).checkBlance(override);
      } catch {
        value = await active.contract.checkBlance(override);
      }
    } else {
      value = await active.contract.checkBlance(override);
    }
    if (session === active) balance.textContent = formatEther(value);
  }

  connect.onclick = () => run(async () => {
    reset("กำลังเชื่อมต่อ…");
    if (!isAddress(BANK_ADDRESS)) throw new Error("ใส่ Contract Address ใน config.js ก่อน");
    const [account] = await wallet.request({ method: "eth_requestAccounts" });
    if (!account) throw new Error("เลือกบัญชีใน MetaMask ก่อน");
    const revision = walletRevision;
    const provider = new BrowserProvider(wallet, SEPOLIA);
    const chainId = BigInt(await wallet.request({ method: "eth_chainId" }));
    if (chainId !== SEPOLIA) throw new Error("สลับ MetaMask ไปที่ Sepolia แล้วเชื่อมต่ออีกครั้ง");
    if (await provider.getCode(BANK_ADDRESS) === "0x") {
      throw new Error("ไม่พบสัญญาที่ Address นี้บน Sepolia");
    }
    const signer = await provider.getSigner(account);
    if (revision !== walletRevision) return;
    const active = { account, contract: new Contract(BANK_ADDRESS, ABI, signer) };
    session = active;
    try {
      await readBalance(active);
    } catch (error) {
      reset("");
      throw error;
    }
    if (session === active) {
      byId("account").textContent = active.account;
      status.textContent = "เชื่อมต่อ MetaMask และสัญญาแล้ว";
    }
  });

  check.onclick = () => run(async () => {
    const active = session;
    await readBalance(active);
    if (session === active) status.textContent = "อัปเดตยอดแล้ว";
  });

  async function submit(withdrawing) {
    const active = session;
    const input = byId("amount").value.trim();
    if (!/^(?:\d+(?:\.\d{1,18})?|\.\d{1,18})$/.test(input)) {
      throw new Error("กรอกจำนวน ETH เป็นตัวเลขทศนิยมไม่เกิน 18 ตำแหน่ง");
    }
    const amount = parseEther(input);
    if (amount <= 0n) throw new Error("จำนวน ETH ต้องมากกว่า 0");

    transaction.hidden = true;
    status.textContent = "ยืนยันธุรกรรมใน MetaMask";
    const tx = withdrawing
      ? await active.contract.withdraw(amount)
      : await active.contract.deposit({ value: amount });
    transaction.href = "https://sepolia.etherscan.io/tx/" + tx.hash;
    transaction.hidden = false;
    status.textContent = "ส่งธุรกรรมแล้ว กำลังรอการยืนยันบน Sepolia…";
    await tx.wait(1, 120_000);
    if (session !== active) return;

    byId("amount").value = "";
    const result = withdrawing ? "ถอนสำเร็จ" : "ฝากสำเร็จ";
    status.textContent = result;
    try {
      await readBalance(active);
    } catch {
      if (session === active) status.textContent = result + " กด Check Balance เพื่ออัปเดตยอด";
    }
  }

  deposit.onclick = () => run(() => submit(false));
  withdraw.onclick = () => run(() => submit(true));

  wallet?.on("accountsChanged", () => {
    walletRevision += 1;
    reset("บัญชีเปลี่ยนแล้ว กรุณาเชื่อมต่ออีกครั้ง");
  });
  wallet?.on("chainChanged", () => {
    walletRevision += 1;
    reset("เครือข่ายเปลี่ยนแล้ว กรุณาเลือก Sepolia และเชื่อมต่ออีกครั้ง");
  });
  reset(wallet ? "เชื่อมต่อ MetaMask เพื่อเริ่มใช้งาน" : "เปิดเว็บด้วยเบราว์เซอร์ที่ติดตั้ง MetaMask");
}

start().catch(() => {
  status.textContent = "โหลดไลบรารี ethers ไม่สำเร็จ ลองรีเฟรชหน้าเว็บ";
});
