# Bons (Backjoon Sync)

## 설치 방법

```sh
npm install -g bons
```

## 설명
Backjoon Sync(이하 bons)은 제출한 제출 코드를 손 쉽게 다운로드 할 수 있는 CLI 도구 입니다.

## 예시

### 기본
```sh
bons -u [아이디]
```

### 모든 제출 기록 다운로드
```sh
bons -u [아이디] --scope all
```

### 첫 정답 제출 파일 출력 파일 경로 설정 
```sh
bons -u [아이디] --scope first --output './backjoon/[problem_id].[ext]'
```

## TODO
- [ ] 날짜 및 갯수 제한 넣기
- [ ] 공개 및 비공개, 정답 시에만 공개 필터 추가
- [ ] --dry-run 및 --overwrite 추가
- [ ] 병렬 처리 다운로드
