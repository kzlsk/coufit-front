import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import iconv from "iconv-lite";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

interface SeoulStoreCsvRow {
  가맹점명: string;
  서울페이업종명: string;
  우편번호: string;
  자치구명: string;
  기본주소: string;
  상세주소: string;
}

interface FormattedStoreData {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  phone_number: null | string;
  category_id: number;
  region_id: number;
}

// 카카오 주소 -> 좌표 변환 API 호출 헬퍼 함수
async function getCoordsByAddress(
  address: string,
  kakaoKey: string,
): Promise<{ lat: number; lon: number }> {
  try {
    const res = await fetch(
      `https://dapi.kakao.com/v2/local/search/address.json?query=${address}`,
      {
        headers: { Authorization: `KakaoAK ${kakaoKey}` },
      },
    );

    // 에러 > 관악구청 기본값
    if (!res.ok) {
      return { lat: 37.4781, lon: 126.9515 };
    }

    const json = await res.json();
    if (json.documents && json.documents.length > 0) {
      return {
        lat: parseFloat(json.documents[0].y),
        lon: parseFloat(json.documents[0].x),
      };
    }
  } catch (error) {
    console.error("좌표 변환 에러 :", error);
  }
  return { lat: 37.4781, lon: 126.9515 };
}

// 공공데이터 업종명 10개의 카테고리 ID로 매핑하는 함수
function mapCategoryToId(apiCategory: string): number {
  if (!apiCategory) return 11;
  if (apiCategory === "음식점/식음료업") return 1;
  if (
    [
      "기술/기능 교육",
      "예술 교육",
      "외국어/언어",
      "입시/교습학원",
      "기타교육기관",
    ].includes(apiCategory)
  )
    return 2;
  if (apiCategory === "식자재/유통") return 3;
  if (apiCategory.includes("미용") || apiCategory.includes("헤어")) return 4;
  if (
    [
      "가구/인테리어",
      "가전/통신",
      "부동산/임대",
      "생활/리빙",
      "자동차/주유",
    ].includes(apiCategory)
  )
    return 5;
  if (apiCategory === "문화/체육") return 6;
  if (apiCategory === "보건/복지") return 7;
  if (apiCategory === "건축/철물" || apiCategory === "디자인/인쇄") return 8;
  if (apiCategory === "여행/숙박") return 9;
  if (apiCategory === "의류/잡화") return 10;
  if (apiCategory === "기타") return 11;
  return 11;
}

export async function GET() {
  try {
    const KAKAO_KEY = process.env.KAKAO_REST_API_KEY;
    const filePath = path.join(
      process.cwd(),
      "public",
      "data",
      "seoul_store.csv",
    );

    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        {
          success: false,
          error: "파일이 없습니다!",
          code_is_looking_at: filePath,
        },
        { status: 404 },
      );
    }
    const fileBuffer = fs.readFileSync(filePath);
    const fileContent = iconv.decode(fileBuffer, "euc-kr");

    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    }) as SeoulStoreCsvRow[];

    const gwanakRows = records.filter((row) => row["자치구명"] === "관악구");

    if (gwanakRows.length === 0) {
      return NextResponse.json({
        success: false,
        message: "관악구 데이터를 찾지 못했습니다. '자치구명' 열을 확인하세요.",
      });
    }

    const uniqueStoresMap = new Map<string, FormattedStoreData>();

    const testSample = gwanakRows.slice(0, 500);

    for (const row of testSample) {
      const fullAddress = `${row["기본주소"]} ${row["상세주소"]}`.trim();

      const uniqueKey = `${row["가맹점명"]}_${fullAddress}`;

      let cleanAddressForKakao = row["기본주소"];
      const splitKeywords = ["1층", "2층", "3층", "지하", "상가", "A동", "B동"];

      for (const keyword of splitKeywords) {
        if (cleanAddressForKakao.includes(keyword)) {
          cleanAddressForKakao = cleanAddressForKakao.split(keyword)[0].trim();
        }
      }

      if (uniqueStoresMap.has(uniqueKey)) {
        continue;
      }

      const coords = await getCoordsByAddress(cleanAddressForKakao, KAKAO_KEY!);

      uniqueStoresMap.set(uniqueKey, {
        name: row["가맹점명"],
        address: fullAddress,
        latitude: coords.lat,
        longitude: coords.lon,
        phone_number: null,
        category_id: mapCategoryToId(row["서울페이업종명"]),
        region_id: 2,
      });
    }

    const formattedStores = Array.from(uniqueStoresMap.values());

    const chunkSize = 500;
    for (let i = 0; i < formattedStores.length; i += chunkSize) {
      const chunk = formattedStores.slice(i, i + chunkSize);
      const { error } = await supabase
        .from("store")
        .upsert(chunk, { onConflict: "name, address" });
      if (error) throw error;
    }

    return NextResponse.json({
      success: true,
      message: `성공! 카카오 좌표 변환을 거쳐 총 ${formattedStores.length}개의 관악구 매장을 DB에 저장했습니다.`,
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "알 수 없는 에러가 발생했습니다.";

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 },
    );
  }
}
