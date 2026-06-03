import os
from pathlib import Path
from cryptography.fernet import Fernet

BACKEND_DIR = Path(__file__).resolve().parents[2]
SECRET_KEY_FILE = BACKEND_DIR / ".secret.key"
LEGACY_SECRET_KEY_FILE = Path(".secret.key")

def get_encryption_key() -> bytes:
    """获取加密密钥"""
    # 1. 尝试从环境变量获取
    key = os.getenv("ENCRYPTION_KEY")
    if key:
        return key.encode()
    
    # 2. 尝试从固定的后端目录读取，兼容旧的当前目录密钥文件
    if SECRET_KEY_FILE.exists():
        return SECRET_KEY_FILE.read_bytes()

    if LEGACY_SECRET_KEY_FILE.exists():
        return LEGACY_SECRET_KEY_FILE.read_bytes()
    
    # 3. 生成并保存
    new_key = Fernet.generate_key()
    SECRET_KEY_FILE.write_bytes(new_key)
    return new_key

_fernet: Fernet | None = None

def get_fernet() -> Fernet:
    global _fernet
    if _fernet is None:
        _fernet = Fernet(get_encryption_key())
    return _fernet

def encrypt_api_key(api_key: str) -> str:
    """加密 API Key"""
    if not api_key:
        return ""
    fernet = get_fernet()
    return fernet.encrypt(api_key.encode()).decode()

def decrypt_api_key(encrypted_key: str) -> str:
    """解密 API Key"""
    if not encrypted_key:
        return ""
    try:
        fernet = get_fernet()
        return fernet.decrypt(encrypted_key.encode()).decode()
    except Exception:
        return ""
