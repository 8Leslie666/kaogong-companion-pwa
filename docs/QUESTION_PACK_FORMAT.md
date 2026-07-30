# 行测题包格式

JSON 顶层由 `manifest` 和 `questions` 组成：

```json
{
  "manifest": {
    "schemaVersion": 1,
    "packId": "my-pack-v1",
    "version": "1.0.0",
    "title": "我的专项题包",
    "license": "用户自有内容",
    "sourceUrl": "https://example.com/source",
    "checksum": "sha256-or-local-checksum"
  },
  "questions": [
    {
      "id": "my-pack-001",
      "packId": "my-pack-v1",
      "module": "判断推理",
      "submodule": "逻辑判断",
      "stem": "题干",
      "options": { "A": "选项A", "B": "选项B", "C": "选项C", "D": "选项D" },
      "answer": "A",
      "explanation": "解析",
      "difficulty": 3,
      "source": "来源名称",
      "sourceUrl": "https://example.com/question",
      "license": "内容许可",
      "year": 2026,
      "region": "全国",
      "tags": ["逻辑判断"]
    }
  ]
}
```

约束：

- `module` 取值：政治理论、常识判断、言语理解、数量关系、判断推理、资料分析。
- `answer` 取值：A、B、C、D。
- `difficulty` 为 1–5 的整数。
- 同一题包内 `id` 唯一，且每题 `packId` 与清单一致。
- `sourceUrl` 使用完整 URL，来源和许可会在题目详情展示。
