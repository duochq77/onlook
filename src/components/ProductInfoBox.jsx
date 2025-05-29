// 07. src/components/ProductInfoBox.tsx
import React from 'react';
const ProductInfoBox = ({ productName, setProductName, link, setLink, }) => {
    return (<div className="space-y-4">
            <div>
                <label className="block font-medium mb-1">Tên sản phẩm</label>
                <input type="text" value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="Nhập tên sản phẩm..." className="w-full border px-3 py-2 rounded-md"/>
            </div>
            <div>
                <label className="block font-medium mb-1">Link giới thiệu sản phẩm (tuỳ chọn)</label>
                <input type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://..." className="w-full border px-3 py-2 rounded-md"/>
                <p className="text-xs text-gray-500 mt-1">
                    Link này sẽ hiển thị cho người xem nếu bạn điền. Có thể là website, Zalo, Facebook...
                </p>
            </div>
        </div>);
};
export default ProductInfoBox;
