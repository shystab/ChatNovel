# RAG（检索增强生成）使用指南

## 什么是 RAG？

RAG = Retrieval Augmented Generation（检索增强生成）

**简单理解：** 让 AI 参考你上传的资料来写作，而不是凭空编造。

## 工作原理

```
1. 上传参考资料
   ↓
2. 系统自动切片、向量化存储
   ↓
3. 写作时自动检索相关片段
   ↓
4. 注入 AI 上下文
   ↓
5. AI 参考你的设定生成内容
```

## 使用场景

### 1. 人物设定
上传人物卡：
```
主角：李明
性格：冷静、理性
背景：前特工，现在是私家侦探
```

写作时 AI 会自动参考这些设定，保持角色一致性。

### 2. 世界观设定
上传世界观文档：
```
魔法体系：
- 元素魔法：火、水、风、土
- 每个人只能掌握一种元素
- 需要通过冥想积累魔力
```

AI 生成的魔法场景会遵循你的设定。

### 3. 情节大纲
上传已写好的章节大纲，AI 续写时会参考前文情节。

### 4. 参考语料
上传类似风格的文章，AI 会学习你喜欢的措辞和节奏。

## 如何使用

### 1. 上传知识库
1. 点击左侧边栏「知识库」按钮
2. 点击上传区域，选择文件（支持 TXT、PDF、DOCX）
3. 系统自动处理（切片、向量化）
4. 上传完成后显示在列表中

### 2. 启用 RAG
在 AI 对话中使用 `/续写` 指令时，RAG 会自动启用。

系统会：
- 根据当前写作内容检索最相关的 5 个片段
- 注入到 AI 提示词中
- AI 参考这些片段生成续写

### 3. 查看效果
对比开启/关闭 RAG 的生成结果：

**不开启 RAG：**
```
主角走进房间，环顾四周...（可能偏离你的设定）
```

**开启 RAG：**
```
李明走进房间，冷静地环顾四周，职业习惯让他下意识地寻找所有出口...
（符合"冷静、前特工"的设定）
```

## 技术细节

### 文件处理流程
1. **切片：** 每 800 字符切一段，重叠 100 字符（避免语义断裂）
2. **向量化：** 使用 sentence-transformers 模型转换成向量
3. **存储：** 保存到 ChromaDB 向量数据库
4. **检索：** 计算相似度，返回最相关的片段

### 当前限制
- **模型未缓存：** 首次使用需要下载 embedding 模型（约 80MB）
- **网络问题：** 国内访问 huggingface 可能超时，已改为离线模式
- **暂时不可用：** 如果模型未本地缓存，RAG 功能会静默跳过

### 如何启用 RAG（需要模型）

**方法 1：手动下载模型**
```bash
cd backend
source venv/Scripts/activate
python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')"
```

**方法 2：使用代理**
```bash
export HF_ENDPOINT=https://hf-mirror.com  # 使用镜像站
python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')"
```

模型会缓存到 `~/.cache/huggingface/`，之后可离线使用。

## 最佳实践

### 1. 上传高质量资料
- ✅ 结构清晰的设定文档
- ✅ 已润色的参考文章
- ❌ 草稿、笔记、碎片化内容

### 2. 分类上传
- 人物设定单独一个文件
- 世界观单独一个文件
- 情节大纲单独一个文件

这样检索更精准。

### 3. 定期更新
- 写作过程中设定有变化，及时更新知识库
- 删除过时的资料

### 4. 控制文件大小
- 单个文件建议不超过 50KB
- 太大的文件会被切成很多片段，检索效率降低

## 常见问题

### Q: 上传后没有效果？
A: 检查：
1. 是否使用了 `/续写` 指令（其他指令不启用 RAG）
2. embedding 模型是否已缓存（看后端日志）
3. 文件内容是否与当前写作相关

### Q: 如何关闭 RAG？
A: 前端代码中 `use_rag: false` 即可。

### Q: 支持哪些文件格式？
A: 目前支持 TXT、PDF、DOCX。

### Q: 知识库存在哪里？
A: 
- 向量数据：`.chroma/` 目录
- 元数据：`novel_ide.db` 数据库

### Q: 如何备份知识库？
A: 备份整个 `.chroma/` 目录和 `novel_ide.db` 文件。

## 进阶：自定义 embedding 模型

如果想用其他模型（如中文优化的模型），修改：

```python
# backend/app/services/knowledge_service.py
class KnowledgeService:
    def __init__(self, model_name: str = "shibing624/text2vec-base-chinese"):
        # 使用中文优化的模型
        ...
```

推荐中文模型：
- `shibing624/text2vec-base-chinese`
- `GanymedeNil/text2vec-large-chinese`

## 总结

RAG 是让 AI 学习你的写作风格和设定的关键技术。虽然目前因为网络问题暂时不可用，但一旦模型缓存到本地，就能大幅提升 AI 生成的质量和一致性。

**核心价值：** 让 AI 成为真正懂你的写作助手，而不是一个"健忘"的工具。
