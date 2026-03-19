# Cofi CLI

커피 추출 기록과 원두 관리를 터미널에서 직접 할 수 있는 CLI.

---

## 설치

```bash
npm install -g @cofi/cli
```

---

## 시작하기

```bash
# Google / GitHub OAuth 로그인 (브라우저 자동 오픈)
cofi_cli auth login

# 로그인 상태 확인
cofi_cli auth status
```

로그인하면 토큰이 `~/.cofi/config.json`에 자동 저장된다. `.env` 파일 설정 불필요.

---

## 명령어

### 인증

```bash
cofi_cli auth login              # OAuth 로그인 (Google / GitHub)
cofi_cli auth login --token <pat> # PAT로 로그인
cofi_cli auth status             # 현재 로그인 상태
cofi_cli auth logout             # 로그아웃
```

### 원두

```bash
cofi_cli bean list               # 내 원두 목록
cofi_cli bean add                # 원두 추가 (인터랙티브)
cofi_cli bean show <id>          # 원두 상세
cofi_cli bean delete <id>        # 원두 삭제
```

### 추출 기록

```bash
cofi_cli brew new                # 새 추출 기록 (인터랙티브)
cofi_cli brew list               # 추출 기록 목록
cofi_cli brew show <id>          # 추출 기록 상세
```

### 설정

```bash
cofi_cli config show             # 현재 설정 확인
cofi_cli config lang             # 언어 변경 (ko / en)
```

---

## OAuth 흐름

```
cofi_cli auth login
  → 제공자 선택 (Google / GitHub)
  → 브라우저 자동 오픈
  → 브라우저에서 인증 완료
  → localhost:54321 로 자동 리다이렉트
  → 토큰 저장 완료 → 터미널로 복귀
```

포트 54321이 사용 중이면 로그인이 실패할 수 있다.

---

## 링크

- 웹: [cofi-web-steel.vercel.app](https://cofi-web-steel.vercel.app)
- MCP: [github.com/Keep-K/Cofi-mcp](https://github.com/Keep-K/Cofi-mcp)
- 이슈: [github.com/Keep-K/Cofi-cli/issues](https://github.com/Keep-K/Cofi-cli/issues)
