import os
import base64
from cryptography.fernet import Fernet
from app.core.config import settings

# 密钥管理：优先从环境变量读取，没有则尝试从本地文件读取，再没有则报错（或者在本地生成一个）
SECRET_KEY_FILE = ".secret.key"

def get_encryption_key() -> bytes:
    """获取加密密钥"""
    # 1. 尝试从环境变量获取
    key = os.getenv("ENCRYPTION_KEY")
    if key:
        return key.encode()
    
    # 2. 尝试从本地文件获取
    if os.path.exists(SECRET_KEY_FILE):
        with open(SECRET_KEY_FILE, "rb") as f:
            return f.read()
    
    # 3. 生成并保存
    new_key = Fernet.generate_key()
    with open(SECRET_KEY_FILE, "wb") as f:
        f.write(new_key)
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
