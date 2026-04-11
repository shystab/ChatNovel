from fastapi import APIRouter, Body, status
from typing import Annotated

from app.models.finetune import FineTunePrepareRequest, FineTunePrepareResponse


router = APIRouter()


@router.post("/prepare", response_model=FineTunePrepareResponse, status_code=status.HTTP_200_OK)
def finetune_prepare(
    payload: Annotated[FineTunePrepareRequest, Body(description="微调准备（占位）")],
):
    """
    微调/训练占位接口。

    说明：
    - 当前项目优先走 RAG（知识库检索增强），不直接训练模型
    - 真正微调需要：数据清洗/标注、费用控制、权限隔离、评测与回滚
    """
    _ = payload  # 占位：未来可在此记录任务、校验数据集等

    return FineTunePrepareResponse(
        supported=False,
        message="当前版本未实现真实微调。建议先使用 RAG（/api/v1/knowledge/*）实现仿写与风格参考。",
        next_steps=[
            "1) 设计训练数据格式（instruction / input / output）与脱敏规则",
            "2) 构建评测集与指标（风格一致性/事实性/重复率）",
            "3) 选择服务商 fine-tuning API，并实现任务队列与费用限额",
            "4) 支持模型版本管理与灰度发布",
        ],
    )

