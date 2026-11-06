# SoundCapsule

React + Vite + JavaScript 기반의 웹 프로젝트 초기 구조입니다.
현재 화면에는 `SoundCapsule` 제목과 `프로젝트 준비 중` 문구만 표시합니다.
화면 크기에 맞춰 글자 크기와 여백이 조절되며, 서비스 기능은 아직 구현하지 않았습니다.

## 개발 환경

- Node.js 22.12.0 이상과 npm

## 로컬 실행

저장소를 복제한 뒤 프로젝트 폴더에서 실행합니다.

```sh
npm ci
npm run dev
```

터미널에 표시되는 로컬 주소를 브라우저에서 엽니다.

## 빌드 및 미리보기

```sh
npm run build
npm run preview
```

빌드 결과는 `dist/`에 생성됩니다. `preview`는 빌드 결과를 로컬에서 확인하는 용도입니다.

## 파일 구성

```text
SoundCapsule/
├── index.html      # HTML 진입점
├── src/
│   ├── main.jsx    # React 렌더링 진입점
│   ├── App.jsx     # 기본 화면 컴포넌트
│   └── styles.css  # 공통 스타일과 반응형 레이아웃
├── package.json    # 의존성과 실행 스크립트
├── package-lock.json # 팀에서 공유하는 의존성 잠금 파일
├── vite.config.js  # Vite 및 React 플러그인 설정
├── .gitignore      # Git 제외 항목
└── README.md       # 프로젝트 안내
```

## 팀 작업

- 작업별 브랜치를 만들고 Pull Request로 변경 사항을 공유합니다.
- `package-lock.json`을 Git에 함께 커밋하고 `npm ci`로 동일한 의존성을 설치합니다.
- 의존성을 추가하거나 변경할 때는 `npm install`을 사용하고 잠금 파일도 함께 공유합니다.
- `node_modules/`, `dist/`, 로컬 환경 변수 파일은 커밋하지 않습니다.
