# 커스텀 도메인 연결 메모

현재 Production은 `https://hermes-atlas-kr.vercel.app`입니다. 실제 보유 도메인을 정하면 아래 순서로 연결합니다.

## 1. 도메인 선택

예시 이름만 적습니다. 아직 확정 도메인을 코드에 하드코딩하지 않습니다.

- `atlas.example.com`
- `hermes.example.com`
- `hermesatlas.kr` 같은 별도 도메인

운영자가 확정한 값을 `CUSTOM_DOMAIN` 또는 `HEREMES_ATLAS_KR_DOMAIN` 메모로 관리합니다. API key나 토큰 값은 문서에 적지 않습니다.

## 2. Vercel에 도메인 추가

```bash
cd /Users/parkeungje/project/hermes-atlas-kr
vercel domains add <CUSTOM_DOMAIN>
vercel alias set hermes-atlas-kr.vercel.app <CUSTOM_DOMAIN>
```

Vercel이 안내하는 DNS 레코드를 도메인 관리 화면에 추가합니다.

일반적인 패턴:

```txt
A     @      76.76.21.21
CNAME www    cname.vercel-dns.com
```

실제 값은 Vercel 안내가 우선입니다.

## 3. SITE_URL로 정적 페이지 재생성

도메인 연결 뒤 canonical, sitemap, OG URL을 새 도메인으로 만들려면:

```bash
SITE_URL=https://<CUSTOM_DOMAIN> npm run build
npm run check
git add sitemap.xml robots.txt projects lists
git commit -m "chore: switch canonical site URL"
git push
vercel deploy --prod --yes
```

## 4. 확인

- `https://<CUSTOM_DOMAIN>` 홈 접속
- `https://<CUSTOM_DOMAIN>/sitemap.xml`
- `https://<CUSTOM_DOMAIN>/projects/NousResearch/hermes-agent`
- 브라우저 console error 없음
- OG image: `/assets/og/atlas-card.svg`

## 주의

- 도메인이 확정되기 전에는 `SITE_URL` 기본값을 `https://hermes-atlas-kr.vercel.app`로 둡니다.
- `OPENROUTER_API_KEY` 값은 이 작업에 필요하지 않습니다.
- 토큰, API key, DNS 계정 비밀번호는 커밋하지 않습니다.
