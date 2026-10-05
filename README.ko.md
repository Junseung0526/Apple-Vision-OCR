# Apple-Vision-OCR

[ [English](README.md) | 한국어 ]

macOS Apple Vision Framework 및 Apple Neural Engine(ANE)을 활용하여 원본 이미지 손실 없이 검색 가능한 PDF(Searchable PDF)를 고속 생성하는 온디바이스 OCR 도구입니다. 미니멀한 웹 대시보드와 스크립트용 CLI를 모두 제공합니다.

---

## 개요

스캔집에서 책이나 문서를 스캔하면 텍스트 검색이나 복사가 불가능한 단순 이미지 PDF 파일로 전달됩니다. 많은 상용 스캔 업체에서는 클라우드나 레거시 OCR 옵션에 대해 페이지당 추가 요금을 청구하며, 이 과정에서 원본 고해상도 이미지가 재압축되어 화질이 저하되기도 합니다.

`Apple-Vision-OCR`는 외부 서버 통신 없이 사용자의 Mac 자체 Neural Engine(`VNRecognizeTextRequest`)에서 100% 로컬로 구동됩니다. 원본 고해상도 이미지의 품질과 DPI를 전혀 손상시키지 않고, 정확한 문자 좌표 위에 보이지 않는 투명 텍스트 레이어를 삽입하여 표준 Searchable PDF를 생성합니다.

---

## 주요 기능

- **무손실 Searchable PDF 생성**: 원본 이미지의 해상도, 색감, 압축 상태를 그대로 보존하며, 정확한 위치에 텍스트 레이어를 얹어 본문 드래그, 복사 및 전문 검색(`Cmd+F`)이 가능합니다.
- **하드웨어 가속 초고속 처리**: Apple Silicon(`M1/M2/M3/M4`)의 Neural Engine 및 GPU를 활용하여 300페이지 분량의 단행본을 1~2분 내외로 고속 처리합니다.
- **2페이지 펼침면(Spread) 자동 분할**: 가로 1장에 책 2페이지가 함께 스캔된 경우, 이미지 손실 없이 좌/우 각각 1페이지씩 세로로 자동 분할 및 정렬합니다 (좌→우 일반 서적 및 우→좌 일본 서적/만화 지원).
- **다중 포맷 동시 추출**: Searchable PDF뿐만 아니라, 페이지 번호가 구조화된 텍스트(`.txt`)와 마크다운(`.md`) 문서를 함께 자동 생성하여 Obsidian, Notion, LLM 맥락 주입용으로 즉시 활용할 수 있습니다.
- **웹 대시보드 & 스크립터블 CLI**: FastAPI 기반의 Apple 시스템 스타일 미니멀 웹 대시보드(한국어/영어 실시간 전환 지원)와 UNIX 표준 CLI를 모두 제공합니다.
- **완전한 온디바이스 구동**: 데이터가 기기 외부로 유출되지 않으며, 인터넷 연결 없이 완전히 오프라인에서 동작합니다.

---

## 아키텍처

```
[ 입력 문서 (PDF / 이미지) ]
              │
              ▼
   [ 파일 무결성 및 암호화 검증 ]
              │
              ▼
  [ 펼침면 무손실 분할 (PyMuPDF) ] (선택 옵션)
              │
              ▼
[ Apple Vision Framework (mac-ocr) ] ── (Neural Engine / GPU 가속)
              │
              ▼
  [ 보이지 않는 텍스트 레이어 합성 ]
              │
              ├─► 검색 가능 PDF (OCR_[파일명].pdf)
              ├─► 구조화 텍스트 (OCR_[파일명].txt)
              └─► 페이지별 마크다운 (OCR_[파일명].md)
```

1. **문서 검증**: PDF 컨테이너 구조 손상 여부 및 비밀번호 암호화 상태를 사전에 검증합니다.
2. **펼침면 분할**: 재래스터화 없이 PDF 내부 스트림 클리핑을 통해 2페이지 가로면을 1페이지씩 무손실 분할합니다.
3. **Vision 텍스트 인식**: 각 페이지 프레임을 Apple의 `VNRecognizeTextRequest` 파이프라인으로 전달하여 라인 및 단어 단위 좌표를 인식합니다.
4. **텍스트 레이어 삽입**: 인식된 글리프 좌표 정보를 CoreText 투명 텍스트 레이어로 PDF 스트림에 직접 주입합니다.
5. **텍스트 구조화 추출**: 생성된 레이어로부터 페이지 경계를 유지한 채 `.txt` 및 `.md` 파일을 빌드합니다.

---

## 환경 요구사항

- **운영체제**: macOS 12.0 (Monterey) 이상 (macOS 14+ Sonoma/Sequoia 권장)
- **아키텍처**: Apple Silicon (arm64) 권장, Intel (x86_64) 지원
- **Node.js**: Node 18 이상 (`mac-ocr` 바이너리 래퍼용)
- **Python**: Python 3.10 이상 (Python 3.14 호환 확인 완료)

### 필수 시스템 패키지 설치

`mac-ocr` 도구를 글로벌 설치합니다:

```bash
npm install -g mac-ocr
```

설치 확인:

```bash
mac-ocr --version
```

---

## 설치 방법

저장소를 클론하고 가상환경을 생성하여 의존성을 설치합니다:

```bash
git clone https://github.com/Junseung0526/Apple-Vision-OCR.git
cd Apple-Vision-OCR

python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

---

## 사용 방법

### 1. 웹 대시보드 (Web Dashboard)

로컬 웹 서버를 실행합니다:

```bash
python3 app.py
```

또는 파인더에서 실행 스크립트를 더블클릭합니다:

```bash
./start.command
```

웹 브라우저에서 `http://localhost:8765` 로 접속합니다. 우측 상단 언어 토글로 한국어/영어를 즉시 전환할 수 있습니다. 스캔 PDF를 드래그 앤 드롭하고 옵션을 선택한 뒤 **OCR 처리 시작**을 클릭하면 Server-Sent Events(SSE)를 통해 실시간 진행률이 표시됩니다.

### 2. 터미널 명령행 인터페이스 (CLI)

단일 파일 및 배치 처리에 적합한 CLI를 제공합니다:

```bash
# 기본 변환 (한국어+영어 OCR, Searchable PDF + TXT + MD 동시 생성)
python3 cli.py scan.pdf

# 2페이지 가로 펼침면을 1페이지씩 분할하며 OCR
python3 cli.py scanned_book.pdf --split-spread

# 우측 페이지부터 읽기 (일본 원서 / 만화)
python3 cli.py manga.pdf --split-spread --rtl --lang ja-en

# 고속 모드 (정확도 대신 처리 속도 극대화)
python3 cli.py scan.pdf --fast

# CLI 인터페이스 언어 지정 (ko 또는 en)
python3 cli.py scan.pdf --locale ko

# 출력 경로 지정 및 완료 후 Finder에서 결과 파일 즉시 열기
python3 cli.py scan.pdf -o ./output --open
```

---

## 설정 및 옵션

### 인식 언어 프로필 (`-l`, `--lang`)

| 코드 | BCP-47 언어 태그 | 설명 |
|:---|:---|:---|
| `ko-en` *(기본값)* | `ko-KR`, `en-US` | 한국어 및 영어 동시 인식 |
| `ko` | `ko-KR` | 한국어 전용 |
| `en` | `en-US` | 영어 전용 |
| `ja-en` | `ja-JP`, `en-US` | 일본어 및 영어 |
| `zh-en` | `zh-Hans`, `en-US` | 중국어 간체 및 영어 |
| `all` | `ko-KR`, `en-US`, `ja-JP` | 다국어 복합 인식 |

### CLI 명령어 인자

```
위치 인자:
  input                 입력 PDF 또는 이미지 파일 경로

옵션:
  -h, --help            도움말 출력 후 종료
  -o, --output-dir DIR  결과물 저장 폴더 (기본값: 입력 파일과 동일 위치)
  -s, --split-spread    2페이지 가로 펼침면을 세로 2페이지로 자동 분할
  --rtl                 펼침면 분할 시 우측 페이지를 먼저 배치 (일본 서적/만화 등)
  -l, --lang PROFILE    인식 언어 프로필 선택 (기본값: ko-en)
  --fast                고속 모드 활성화 (처리량 우선)
  --no-txt              .txt 텍스트 파일 생성 생략
  --no-md               .md 마크다운 파일 생성 생략
  --open                변환 완료 후 macOS Finder에서 결과 PDF 파일 위치 표시
  --locale {ko,en}      CLI 출력 인터페이스 언어 (기본값: 시스템 로케일)
```

---

## 스캔집 방문 시 가이드

1. **OCR 유료 옵션 결제 불필요**: 스캔 업체에서 제공하는 구형 소프트웨어(Tesseract, 구형 ABBYY)보다 Mac의 Apple Vision Framework가 한글 받침, 특수기호, 영문 복합 인식이 훨씬 정밀합니다. 추가금 없이 고화질 원본 PDF로만 받아오세요.
2. **해상도 설정 추천**:
   - 일반 텍스트 위주 서적: **300 DPI** 권장 (속도, 용량, 인식률 균형 최적)
   - 수식, 작은 각주, 도판이 많은 서적: **400~600 DPI** 권장
3. **스캔 형태**:
   - 낱장 자동급지(ADF) 스캔본: 그대로 입력
   - 양면 펼침면 스캔본: **"2페이지 펼침면 분할"** 옵션 켜기

---

## 라이선스

MIT License. 상세 내용은 `LICENSE` 파일을 참고하십시오.
