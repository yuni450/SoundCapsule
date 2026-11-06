import React from 'react';

// 16x16 픽셀 아트를 렌더링하는 범용 DotPixel SVG 렌더러
export function DotPixelGrid({ pixels, palette, size = 64, className = '' }) {
  const pixelSize = size / 16;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      className={`pixel-art-svg ${className}`}
      style={{ imageRendering: 'pixelated', shapeRendering: 'crispEdges' }}
    >
      {pixels.map((row, y) =>
        row.split('').map((char, x) => {
          const color = palette[char];
          if (!color || color === 'none') return null;
          return <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={color} />;
        })
      )}
    </svg>
  );
}

/* ==========================================================================
   11월 테마: 새 (Bird) 6마리 도트 디자인
   ========================================================================== */

// 1. 파랑새 (Bluebird)
const bluebirdPixels = [
  '................',
  '....BBBB........',
  '...BLLLLB.......',
  '..BLLWWLLBO.....',
  '..BLLWWLLBOO....',
  '..BLKKLLLLBO....',
  '..BLLLLLLLB.....',
  '...BLLLLLB......',
  '..BBDDDDDBB.....',
  '.BDDDDDDDDDB....',
  '.BDDDDDDDDDB....',
  '.BDDDDDDDDDB....',
  '..BBDDDDDBB.....',
  '...B.FFF.B......',
  '....FF.FF.......',
  '................',
];

const bluebirdPalette = {
  B: '#1a365d', // 다크 아웃라인
  L: '#60a5fa', // 라이트 블루
  D: '#2563eb', // 딥 블루
  W: '#ffffff', // 눈 흰자
  K: '#1e293b', // 눈동자
  O: '#f59e0b', // 부리 오렌지
  F: '#d97706', // 발
};

// 2. 노랑 카나리아 (Canary)
const canaryPixels = [
  '.....MM.........',
  '....MMMM........',
  '...YYYYYY.......',
  '..YYWWYYYO......',
  '..YYWWYYYOO.....',
  '..YYKYYYYYO.....',
  '..YYYYYYYY......',
  '...YYYYYY.......',
  '..YYGGGGYY......',
  '.YGGGGGGGGY.....',
  '.YGGGGGGGGY.....',
  '.YGGGGGGGGY.....',
  '..YYGGGGYY......',
  '...Y.FFF.Y......',
  '....FF.FF.......',
  '................',
];

const canaryPalette = {
  M: '#ec4899', // 리본 핑크
  Y: '#fef08a', // 밝은 노랑
  G: '#eab308', // 골드 옐로우
  W: '#ffffff',
  K: '#1e293b',
  O: '#ea580c',
  F: '#ca8a04',
};

// 3. 분홍 홍학 (Flamingo)
const flamingoPixels = [
  '................',
  '....PPPP........',
  '...PLLLLP.......',
  '..PLWWLLPO......',
  '..PLWWLLPOO.....',
  '..PLKLLLLPO.....',
  '...PLLLLP.......',
  '....PLP.........',
  '....PLP.........',
  '..PPDDDPP.......',
  '.PDDDDDDDP......',
  '.PDDDDDDDP......',
  '..PPDDDPP.......',
  '...P.FFF.P......',
  '....F...F.......',
  '....F...F.......',
];

const flamingoPalette = {
  P: '#831843',
  L: '#f472b6',
  D: '#db2777',
  W: '#ffffff',
  K: '#000000',
  O: '#1e293b',
  F: '#be185d',
};

// 4. 눈꽃 비둘기 (Snow Dove)
const dovePixels = [
  '................',
  '....WWWW........',
  '...WLLLLW.......',
  '..WLKKLLWGG.....',
  '..WLKKLLWGGG....',
  '..WLLLLLW.......',
  '...WLLLLW.......',
  '..WWSSSSWW......',
  '.WSSSSSSSSW.....',
  '.WSSSSSSSSW.....',
  '.WSSSSSSSSW.....',
  '..WWSSSSWW......',
  '...W.FFF.W......',
  '....FF.FF.......',
  '................',
  '................',
];

const dovePalette = {
  W: '#475569',
  L: '#ffffff',
  S: '#e2e8f0',
  K: '#0f172a',
  G: '#10b981', // 올리브 나뭇잎
  F: '#f87171',
};

// 5. 황금 부엉이 (Owl)
const owlPixels = [
  '..BB.....BB.....',
  '.BLLB...BLLB....',
  '.BLLLLLLLLLB....',
  '.BLWWLBLWWLB....',
  '.BLWWLBLWWLB....',
  '.BLKKOBIKKLB....',
  '.BLLLOOOLLLB....',
  '.BLLLLLLLLLB....',
  '.BLLDDDDDLLB....',
  '.BLDDDDDDDDB....',
  '.BLDDDDDDDDB....',
  '.BLDDDDDDDDB....',
  '..BLLDDDLLB.....',
  '...B.FFF.B......',
  '....FF.FF.......',
  '................',
];

const owlPalette = {
  B: '#451a03',
  L: '#b45309',
  D: '#78350f',
  W: '#fef3c7',
  K: '#000000',
  O: '#f59e0b',
  F: '#d97706',
};

// 6. 무지개 극락조 (Rainbow Bird) - 합창 리더
const rainbowBirdPixels = [
  '...CCC.CCC......',
  '..C11C.C11C.....',
  '..C1111111C.....',
  '.C11WW1111CO....',
  '.C11WW1111COO...',
  '.C11KK1111CO....',
  '..C111111C......',
  '..C223344C......',
  '.C222333444C....',
  '.C222333444C....',
  '.C555666777C....',
  '..C556677C......',
  '...C.FFF.C......',
  '....FF.FF.......',
  '................',
  '................',
];

const rainbowBirdPalette = {
  C: '#1e1b4b',
  1: '#ec4899', // 핑크 헤드
  2: '#ef4444', // 레드
  3: '#f59e0b', // 옐로우
  4: '#10b981', // 그린
  5: '#06b6d4', // 시안
  6: '#3b82f6', // 블루
  7: '#8b5cf6', // 퍼플
  W: '#ffffff',
  K: '#000000',
  O: '#fbbf24',
  F: '#f59e0b',
};

/* ==========================================================================
   10월 테마: 악어 (Crocodile)
   ========================================================================== */
const croc1Pixels = [
  '................',
  '......GGGG......',
  '..GG.GLLLLG.....',
  '.GLLGGLKKLLG....',
  'GLLLGGLKKLLG....',
  'GLLLLLLLLLLG....',
  'GLLLLLLLLLLGG...',
  '.GLLWWLLLLLLLG..',
  '..GLLLLLLWWLLLG.',
  '..GGLLLLLLLLLLG.',
  '.GLLGGGGGGLLLLG.',
  'GLLG......GLLLG.',
  'GLLG......GLLLG.',
  '.GG........GG...',
  '................',
  '................',
];

const croc1Palette = {
  G: '#064e3b',
  L: '#10b981',
  K: '#022c22',
  W: '#ffffff',
};

const croc2Pixels = [
  '....FFFF........',
  '....FFFF........',
  '......GGGG......',
  '..GG.GLLLLG.....',
  '.GLLGGLKKLLG....',
  'GLLLGGLKKLLG....',
  'GLLLLLLLLLLG....',
  'GLLLLLLLLLLGG...',
  '.GLLWWLLLLLLLG..',
  '..GLLLLLLWWLLLG.',
  '..GGLLLLLLLLLLG.',
  '.GLLGGGGGGLLLLG.',
  'GLLG......GLLLG.',
  '.GG........GG...',
  '................',
  '................',
];

const croc2Palette = {
  F: '#f43f5e', // 꽃 모자
  G: '#14532d',
  L: '#84cc16', // 연두 악어
  K: '#052e16',
  W: '#ffffff',
};

// 11월 새 6마리 메타데이터
export const novemberBirds = [
  {
    id: 'bird-1',
    name: '하늘 파랑새',
    streakRequired: 5,
    soundNote: '짹- 짹! 청아한 소리',
    pixels: bluebirdPixels,
    palette: bluebirdPalette,
    color: '#3959cc',
    story: '5일 연속으로 소리를 모았더니 푸른 하늘에서 내려왔어요.',
  },
  {
    id: 'bird-2',
    name: '노랑 카나리아',
    streakRequired: 10,
    soundNote: '트릴릴리- 맑은 피리 소리',
    pixels: canaryPixels,
    palette: canaryPalette,
    color: '#eab308',
    story: '10일 연속 기록을 축하하며 머리에 리본을 단 카나리아가 합류했어요.',
  },
  {
    id: 'bird-3',
    name: '분홍 플라밍고',
    streakRequired: 15,
    soundNote: '퐁- 퐁! 우아한 리듬',
    pixels: flamingoPixels,
    palette: flamingoPalette,
    color: '#ec4899',
    story: '15일 차에 찾아온 분홍빛 우아한 날갯짓의 새예요.',
  },
  {
    id: 'bird-4',
    name: '눈꽃 비둘기',
    streakRequired: 20,
    soundNote: '구구- 평온한 숨소리',
    pixels: dovePixels,
    palette: dovePalette,
    color: '#64748b',
    story: '20일의 일상을 꾸준히 기록해 평화의 올리브 잎을 물고 왔어요.',
  },
  {
    id: 'bird-5',
    name: '황금 부엉이',
    streakRequired: 25,
    soundNote: '부엉- 부엉! 깊은 울림',
    pixels: owlPixels,
    palette: owlPalette,
    color: '#b45309',
    story: '25일 연속 기록을 달성하여 깊은 밤의 지혜를 전해주는 부엉이예요.',
  },
  {
    id: 'bird-6',
    name: '무지개 극락조',
    streakRequired: 30,
    soundNote: '라- 라- 라! 농장 합창의 리더',
    pixels: rainbowBirdPixels,
    palette: rainbowBirdPalette,
    color: '#8b5cf6',
    story: '30일 완성! 모든 색을 품은 극락조가 도착해 농장의 합창을 지휘해요.',
  },
];

// 10월 악어 2마리 (지난 달 농장 보관용)
export const octoberCrocs = [
  {
    id: 'croc-1',
    name: '초록 늪지 악어',
    acquiredDate: '2026-10-05',
    pixels: croc1Pixels,
    palette: croc1Palette,
  },
  {
    id: 'croc-2',
    name: '꽃 모자 아기 악어',
    acquiredDate: '2026-10-10',
    pixels: croc2Pixels,
    palette: croc2Palette,
  },
];
