"use client";
import { useState, useEffect } from "react";
import { Search, ChevronDown, X } from "lucide-react";
import { Region } from "@/lib/types/region";
import { SearchParams } from "@/lib/types/searchParams";

interface StoreFindSideBarProps {
  isOpen: boolean;
  onClose: () => void;
  searchParams: SearchParams;
  setSearchParams: (params: (prev: SearchParams) => SearchParams) => void;
  onReset: () => void;
}

export default function StoreFindSideBar({
  isOpen,
  onClose,
  searchParams,
  setSearchParams,
  onReset,
}: StoreFindSideBarProps) {
  const categories = [
    { id: 1, name: "음식점", icon: "🍽️" },
    { id: 2, name: "교육", icon: "📚" },
    { id: 3, name: "마트", icon: "🛒" },
    { id: 4, name: "미용", icon: "💄" },
    { id: 5, name: "생활", icon: "🏠" },
    { id: 6, name: "스포츠", icon: "🏃‍♀️" },
    { id: 7, name: "의료", icon: "🏥" },
    { id: 8, name: "제조", icon: "🏭" },
    { id: 9, name: "숙박", icon: "🏘️" },
    { id: 10, name: "잡화", icon: "🛍️" },
  ];

  const [regions, setRegions] = useState<Region[]>([]);
  const [parentRegions, setParentRegions] = useState<Region[]>([]);
  const [childRegions, setChileRegions] = useState<Region[]>([]);
  const [selectedParentId, setSelectedParentId] = useState<number | null>(null);

  const fetchRegions = async () => {
    try {
      const api = `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/regions/categories`;
      const token = localStorage.getItem("authToken");
      const res = await fetch(api, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        throw new Error("네트워크 에러");
      }
      const result = await res.json();
      const allRegions: Region[] = result.data;

      setRegions(allRegions);

      const parents = allRegions.filter((region) => region.parentId === null);
      setParentRegions(parents);
    } catch (error) {
      console.error("지역 카테고리 불러오기 실패: ", error);
    }
  };

  useEffect(() => {
    fetchRegions();
  }, []);

  useEffect(() => {
    if (selectedParentId) {
      const selectParent = regions.find(
        (region) => region.id === selectedParentId,
      );
      if (selectParent) {
        const children = regions.filter((region) =>
          selectParent.childrenIdList.includes(region.id),
        );
        setChileRegions(children);
      }
    } else {
      setChileRegions([]);
    }
  }, [selectedParentId, regions]);

  const handleParentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const parentId = e.target.value ? Number(e.target.value) : null;
    setSelectedParentId(parentId);

    const selectedParent = parentRegions.find((p) => p.id === parentId);
    setSearchParams((prev) => ({
      ...prev,
      region: selectedParent ? selectedParent.name : "",
      area: "",
    }));
  };

  const handleAreaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedAreaName = e.target.value;
    setSearchParams((prev) => ({
      ...prev,
      area: selectedAreaName,
    }));
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value, checked } = e.target;
    setSearchParams((prev) => ({
      ...prev,
      category: checked ? value : "",
    }));
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSearchParams((prev) => ({
      ...prev,
      sort: e.target.value,
    }));
  };

  return (
    <>
      {isOpen && <div className="fixed inset- z-40" onClick={onClose}></div>}
      <div className="flex h-[calc(100vh-64px)] relative">
        {/* 토글 가능한 필터 사이드바 */}
        <div
          className={`h-full bg-white shadow-xl transform transition-all duration-300 ease-in-out overflow-hidden z-20
            ${isOpen ? "w-80" : "w-0"}`}
        >
          <div className="px-6 py-6 space-y-6 h-full overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-gray-900">필터</h3>
              <button onClick={onClose}>
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* 검색 */}
            <div className="p-2 relative rounded-md border border-gray-300">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                id="store-search"
                name="search-query"
                type="text"
                placeholder="가맹점명, 주소 검색"
                className="pl-10 w-full text-black"
                value={searchParams?.keyword || ""}
                onChange={(e) =>
                  setSearchParams((prev) => ({
                    ...prev,
                    keyword: e.target.value,
                  }))
                }
              />
            </div>

            {/* 지역 선택 */}
            <div className="space-y-5">
              <h3 className="font-semibold text-gray-900">지역 선택</h3>
              <div className="grid grid-cols-1 gap-2">
                <div className="relative">
                  <select
                    value={selectedParentId || ""}
                    onChange={handleParentChange}
                    className="w-full text-black p-2 rounded-md border appearance-none border-gray-300 pr-10"
                  >
                    <option value="">시/도 선택</option>
                    {parentRegions.map((region) => (
                      <option key={region.id} value={region.id}>
                        {region.name}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                    <ChevronDown className="h-4 w-4" />
                  </div>
                </div>
                <div className="relative">
                  <select
                    value={searchParams?.area || ""}
                    onChange={handleAreaChange}
                    disabled={!selectedParentId}
                    className="w-full text-black p-2 rounded-md border appearance-none border-gray-300 pr-10"
                  >
                    <option value="">시/군/구 선택</option>
                    {childRegions.map((region) => (
                      <option key={region.id} value={region.name}>
                        {region.name}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                    <ChevronDown className="h-4 w-4" />
                  </div>
                </div>
              </div>
            </div>

            {/* 업종 선택 */}
            <div className=" space-y-3">
              <h3 className="font-semibold text-gray-900">업종 선택</h3>
              <div className="space-y-3">
                {categories.map((category) => (
                  <div key={category.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      key={category.id}
                      value={category.name}
                      checked={searchParams?.category === category.name}
                      onChange={handleCategoryChange}
                    />
                    <label
                      htmlFor={category.name}
                      className="flex text-black items-center space-x-2 cursor-pointer flex-1"
                    >
                      <span>{category.icon}</span>
                      <span className="text-sm">{category.name}</span>
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* 정렬 */}
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900">정렬</h3>
              <div className="relative">
                <select
                  value={searchParams?.sort}
                  onChange={handleSortChange}
                  className="w-full text-black p-2 rounded-md border appearance-none border-gray-300 pr-10"
                >
                  <option value="popularity">인기순</option>
                  <option value="distance">가까운 순</option>
                  <option value="discount">할인률 순</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                  <ChevronDown className="h-4 w-4" />
                </div>
              </div>
            </div>

            {/* 필터 초기화 */}
            <button
              onClick={() => {
                onReset();
              }}
              className="p-2 w-full bg-transparent border border-gray-300 rounded-md font-medium text-gray-900"
            >
              필터 초기화
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
