import React, { useState, useCallback, useRef } from 'react';

/**
 * Virtual List Component using React Window pattern
 * Efficiently renders 10k+ items by only rendering visible items
 * Dramatically reduces memory usage and improves scroll performance
 */

export interface VirtualListProps<T> {
  items: T[];
  itemHeight: number;
  height: number;
  width: string | number;
  renderItem: (item: T, index: number) => React.ReactNode;
  overscan?: number; // Number of items to render outside visible area
  className?: string;
  onScroll?: (top: number) => void;
}

const VirtualProductListBase = function VirtualProductList<T>({
  items,
  itemHeight,
  height,
  width,
  renderItem,
  overscan = 5,
  className = '',
  onScroll,
}: VirtualListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Calculate visible range
  const visibleStartIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const visibleEndIndex = Math.min(
    items.length,
    Math.ceil((scrollTop + height) / itemHeight) + overscan
  );

  const visibleItems = items.slice(visibleStartIndex, visibleEndIndex);
  const offsetY = visibleStartIndex * itemHeight;

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const top = e.currentTarget.scrollTop;
      setScrollTop(top);
      onScroll?.(top);
    },
    [onScroll]
  );

  const totalHeight = items.length * itemHeight;

  return (
    <div
      ref={scrollRef}
      style={{
        width,
        height,
        overflow: 'auto',
      }}
      onScroll={handleScroll}
      className={className}
    >
      {/* Placeholder for items before visible range */}
      <div style={{ height: offsetY }} />

      {/* Visible items */}
      <div>
        {visibleItems.map((item, i) => (
          <div
            key={visibleStartIndex + i}
            style={{
              height: itemHeight,
              overflow: 'hidden',
            }}
          >
            {renderItem(item, visibleStartIndex + i)}
          </div>
        ))}
      </div>

      {/* Placeholder for items after visible range */}
      <div style={{ height: totalHeight - (offsetY + visibleItems.length * itemHeight) }} />
    </div>
  );
};

export const VirtualProductList = React.memo(VirtualProductListBase) as <T>(
  props: VirtualListProps<T>
) => JSX.Element;

/**
 * Product-specific virtual list wrapper
 */
export interface Product {
  id: string;
  name: string;
  sku: string;
  price: number;
  [key: string]: any;
}

export function VirtualProductListContainer({
  products,
  onSelectProduct,
  height = 600,
}: {
  products: Product[];
  onSelectProduct?: (product: Product) => void;
  height?: number;
}) {
  const handleSelectProduct = useCallback(
    (product: Product) => {
      onSelectProduct?.(product);
    },
    [onSelectProduct]
  );

  const renderProductRow = useCallback(
    (product: Product, index: number) => (
      <div
        onClick={() => handleSelectProduct(product)}
        className={`flex px-4 py-3 border-b border-border cursor-pointer transition-colors min-h-[72px] ${
          index % 2 === 0 ? 'bg-card' : 'bg-muted/35'
        } hover:bg-accent/15`}
      >
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">
            {product.name}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            SKU: {product.sku}
          </div>
        </div>
        <div className="text-right pl-4">
          <div className="font-semibold text-accent">${product.price.toFixed(2)}</div>
        </div>
      </div>
    ),
    [handleSelectProduct]
  );

  return (
    <VirtualProductList<Product>
      items={products}
      itemHeight={72}
      height={height}
      width="100%"
      renderItem={renderProductRow}
      overscan={10}
    />
  );
}

/**
 * Example usage:
 * 
 * import { VirtualProductListContainer } from '@/components/VirtualProductList';
 * 
 * function ProductCatalog() {
 *   const [products, setProducts] = useState<Product[]>([]);
 *   
 *   useEffect(() => {
 *     // Fetch up to 100k products
 *     fetchAllProducts().then(setProducts);
 *   }, []);
 *   
 *   return (
 *     <VirtualProductListContainer
 *       products={products}
 *       height={600}
 *       onSelectProduct={(product) => console.log(product)}
 *     />
 *   );
 * }
 */
