from __future__ import annotations

import unittest

from app.services.ai_context import (
    chapter_brief,
    clip_text,
    detect_memory_profile,
    plain_text,
    requests_external_reference,
)


class AiContextTests(unittest.TestCase):
    def test_plain_text_and_brief_preserve_useful_novel_text(self) -> None:
        self.assertEqual(plain_text("<p>第一句。</p><p>最后一句。</p>"), "第一句。\n\n最后一句。")
        self.assertEqual(chapter_brief("", "<p>第一句。</p><p>最后一句。</p>"), "第一句。 最后一句。")
        self.assertEqual(clip_text("abcdef", 3), "abc...（已截断）")

    def test_memory_profile_routes_common_writing_requests(self) -> None:
        self.assertEqual(detect_memory_profile("帮我续写下一段").name, "draft")
        self.assertEqual(detect_memory_profile("检查全书结构和人物线").name, "structure")
        self.assertEqual(detect_memory_profile("把这段润色一下").name, "rewrite")
        self.assertEqual(detect_memory_profile("你好").name, "default")

    def test_external_reference_requires_explicit_intent(self) -> None:
        self.assertTrue(requests_external_reference("参考知识库里的设定"))
        self.assertFalse(requests_external_reference("看看本书前面的设定"))


if __name__ == "__main__":
    unittest.main()
