# Hermes Atlas KR

Hermes Agent 생태계를 한국어로 탐색하기 위한 별도 구현체입니다.

원본 Hermes Atlas를 그대로 번역한 fork가 아니라, 한국어 사용자를 위한 별도 정적 앱으로 구현했습니다.

## 현재 범위

- 한국어 UI
- 한국어 카테고리 체계
- 검색/필터/정렬
- 프로젝트 상세 패널
- 원본 `repos.json` 기반 데이터 로딩
- 일부 프로젝트 설명의 한국어 보조 요약

## 아직 완전 한글판이 아닌 부분

- 각 GitHub 프로젝트 README 전문
- RAG 챗봇 지식베이스
- 모든 프로젝트 설명의 사람 손 검수 번역
- 리포트/가이드 전문 번역

## 실행

```bash
npm run serve
```

브라우저:

```txt
http://localhost:4181
```

## 검증

```bash
npm run check
```

## 데이터 출처

- https://github.com/ksimback/hermes-ecosystem
- https://hermesatlas.com/
