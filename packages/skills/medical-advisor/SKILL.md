---
name: medical-advisor
description: 基于多数据源可插拔架构的通用医疗助手，支持药品查询、诊断参考、体检报告解读
version: 1.1.0
author: SelfClaw
model_support:
  - gpt-4o
  - claude-3.7-sonnet
tags:
  - medical
  - health
  - pharmacy
  - diagnosis
domain: medical
capability: health-consultation
---

## Instructions

This skill provides medical consultation based on multiple pluggable data sources.

### Capabilities
1. Drug information lookup (trade name / generic name / dosage)
2. Medical examination report interpretation
3. Drug interaction analysis
4. Symptom analysis
5. Literature search

### Data Sources
- PubMed (biomedical literature)
- Clinical Guidelines (standard treatment protocols)
- Optional: Zhongkang Health Tech database

### Safety Guidelines
- Always include disclaimer: "仅供医疗专业人员参考，不构成诊疗建议"
- Flag emergency symptoms immediately
- Never provide definitive diagnosis

## Examples

- Look up ibuprofen dosage and contraindications
- Interpret blood test results with abnormal markers
- Check drug interactions between aspirin and warfarin

## Limitations

- Not a substitute for professional medical advice
- Emergency situations require immediate medical attention
- Drug interaction database may not cover all combinations
- Chinese medicine data sources are optional and may be unavailable
