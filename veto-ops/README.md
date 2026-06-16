# veto-ops

Veto operator artifacts for Paperclip deploy, smoke, and promotion receipts.

Paperclip **core** stays upstream (`paperclipai/paperclip`). This tree holds deploy policy, runbooks, and receipts only.

## Paperclip promotions

| Release | Runbook |
|---------|---------|
| `v2026.609.0` | [paperclip/promotions/v2026.609.0/RUNBOOK.md](./paperclip/promotions/v2026.609.0/RUNBOOK.md) |

### Quick start (staging)

```bash
cd paperclip/promotions/v2026.609.0
cp receipt.template.yaml artifacts/promo-$(date -u +%Y%m%d)-6090/receipt.yaml
# Complete ASSUMPTIONS.md, then:
export COMPANY_ID=... AGENT_ID=...
chmod +x smoke.sh && ./smoke.sh
```

### URLs

- Staging: https://paperclip-staging.tryveto.com
- Production: https://paperclip.tryveto.com
