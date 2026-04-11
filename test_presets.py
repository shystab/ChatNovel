"""
测试人格预设功能的脚本
"""
import requests
import json

BASE_URL = "http://localhost:8000/api/v1"

def test_presets():
    print("=== 测试人格预设功能 ===\n")

    # 1. 创建一个新的人格预设
    print("1. 创建新的人格预设...")
    create_data = {
        "name": "严肃学术风格",
        "description": "适合写作学术论文或严肃文学作品",
        "system_prompt": "你是一个严谨的学术写作助手。\n\n写作要求：\n- 使用正式、规范的书面语\n- 避免口语化表达\n- 注重逻辑性和严谨性\n- 引用准确，表述客观",
        "is_enabled": False
    }

    response = requests.post(f"{BASE_URL}/presets/", json=create_data)
    if response.status_code == 201:
        preset1 = response.json()
        print(f"[OK] 创建成功: ID={preset1['id']}, 名称={preset1['name']}")
    else:
        print(f"[FAIL] 创建失败: {response.status_code} - {response.text}")
        return

    # 2. 创建第二个预设
    print("\n2. 创建第二个人格预设...")
    create_data2 = {
        "name": "轻松诙谐风格",
        "description": "适合写作轻松幽默的小说或随笔",
        "system_prompt": "你是一个充满活力的写作助手。\n\n写作特点：\n- 语言生动活泼\n- 善用比喻和幽默\n- 贴近生活，通俗易懂\n- 注重可读性和趣味性",
        "is_enabled": False
    }

    response = requests.post(f"{BASE_URL}/presets/", json=create_data2)
    if response.status_code == 201:
        preset2 = response.json()
        print(f"✓ 创建成功: ID={preset2['id']}, 名称={preset2['name']}")
    else:
        print(f"✗ 创建失败: {response.status_code}")
        return

    # 3. 列出所有预设
    print("\n3. 列出所有人格预设...")
    response = requests.get(f"{BASE_URL}/presets/")
    if response.status_code == 200:
        data = response.json()
        print(f"✓ 共有 {data['total']} 个预设:")
        for p in data['items']:
            status = "✓ 已启用" if p['is_enabled'] else "○ 未启用"
            print(f"  {status} - {p['name']}: {p['description']}")
    else:
        print(f"✗ 获取失败: {response.status_code}")
        return

    # 4. 启用第一个预设
    print(f"\n4. 启用预设 '{preset1['name']}'...")
    response = requests.patch(f"{BASE_URL}/presets/{preset1['id']}/toggle")
    if response.status_code == 200:
        updated = response.json()
        print(f"✓ 启用成功: is_enabled={updated['is_enabled']}")
    else:
        print(f"✗ 启用失败: {response.status_code}")
        return

    # 5. 验证只有一个预设被启用
    print("\n5. 验证启用状态...")
    response = requests.get(f"{BASE_URL}/presets/")
    if response.status_code == 200:
        data = response.json()
        enabled_count = sum(1 for p in data['items'] if p['is_enabled'])
        print(f"✓ 当前启用的预设数量: {enabled_count} (应该为1)")
        if enabled_count == 1:
            enabled_preset = next(p for p in data['items'] if p['is_enabled'])
            print(f"  已启用: {enabled_preset['name']}")

    # 6. 更新预设内容
    print(f"\n6. 更新预设 '{preset2['name']}'...")
    update_data = {
        "description": "适合写作幽默小品文和轻松小说（已更新）",
    }
    response = requests.put(f"{BASE_URL}/presets/{preset2['id']}", json=update_data)
    if response.status_code == 200:
        updated = response.json()
        print(f"✓ 更新成功: {updated['description']}")
    else:
        print(f"✗ 更新失败: {response.status_code}")

    # 7. 测试切换到第二个预设
    print(f"\n7. 切换到预设 '{preset2['name']}'...")
    response = requests.patch(f"{BASE_URL}/presets/{preset2['id']}/toggle")
    if response.status_code == 200:
        print("✓ 切换成功")
        # 验证第一个预设已被禁用
        response = requests.get(f"{BASE_URL}/presets/{preset1['id']}")
        if response.status_code == 200:
            p1_status = response.json()
            print(f"  预设1状态: is_enabled={p1_status['is_enabled']} (应该为False)")

    # 8. 删除第一个预设
    print(f"\n8. 删除预设 '{preset1['name']}'...")
    response = requests.delete(f"{BASE_URL}/presets/{preset1['id']}")
    if response.status_code == 204:
        print("✓ 删除成功")
    else:
        print(f"✗ 删除失败: {response.status_code}")

    # 9. 验证删除后的列表
    print("\n9. 验证删除后的预设列表...")
    response = requests.get(f"{BASE_URL}/presets/")
    if response.status_code == 200:
        data = response.json()
        print(f"✓ 剩余 {data['total']} 个预设:")
        for p in data['items']:
            status = "✓ 已启用" if p['is_enabled'] else "○ 未启用"
            print(f"  {status} - {p['name']}")

    print("\n=== 测试完成 ===")

if __name__ == "__main__":
    import sys
    try:
        test_presets()
    except requests.exceptions.ConnectionError:
        print("✗ 错误: 无法连接到后端服务器")
        print("  请先启动后端: cd backend && uvicorn app.main:app --reload")
        sys.exit(1)
    except Exception as e:
        print(f"✗ 测试出错: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
