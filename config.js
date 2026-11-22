// คัดลอก Contract Address จาก Remix หลัง Deploy บน Sepolia
export const BANK_ADDRESS = "0xe6e67A3E7ffB8c420e92DaCB46196a11c1F12AEB";
export const STUDENT_ID = "66023796";
export const STUDENT_NAME = "ณัฐชยา ตั้งมั่น";

// กรอกเฉพาะ Infura API Key หรือเว้นว่างเพื่ออ่านยอดผ่าน MetaMask
const INFURA_API_KEY = "";
const infuraKey = INFURA_API_KEY.trim();
export const READ_RPC_URL = infuraKey
  ? "https://sepolia.infura.io/v3/" + encodeURIComponent(infuraKey)
  : "";
