"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addProductPrice } from "@/actions/shopping";
import type { Store } from "@/lib/grocery";

export function PriceEntry({ stores }: { stores: Store[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [storeId, setStoreId] = useState(stores[0]?.id ?? "");
  const [productName, setProductName] = useState("");
  const [brand, setBrand] = useState("");
  const [price, setPrice] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [unit, setUnit] = useState("");
  const [packageSize, setPackageSize] = useState("");

  function submit() {
    if (!storeId) {
      toast.error("Pick a store first.");
      return;
    }
    if (!productName.trim() || !price) {
      toast.error("Enter a product and price.");
      return;
    }
    startTransition(async () => {
      const res = await addProductPrice({
        storeId,
        productName: productName.trim(),
        brand: brand.trim() || undefined,
        price: Number(price),
        salePrice: salePrice ? Number(salePrice) : undefined,
        unit: unit.trim() || undefined,
        packageSize: packageSize.trim() || undefined,
      });
      if (res.ok) {
        toast.success("Price added.");
        setProductName("");
        setBrand("");
        setPrice("");
        setSalePrice("");
        setUnit("");
        setPackageSize("");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Record a price</CardTitle>
        <CardDescription>
          Add prices you&apos;ve seen so shopping lists can compare stores. Only enter prices you have
          permission to record (your own receipts, in-store, or flyers).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="price-store">Store</Label>
          <select
            id="price-store"
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
            className="h-10 w-full rounded-xl border border-input bg-card px-3 text-sm"
          >
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="price-product">Product</Label>
            <Input
              id="price-product"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="e.g. chicken breast"
              maxLength={120}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="price-brand">Brand (optional)</Label>
            <Input
              id="price-brand"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="e.g. Nature's Promise"
              maxLength={60}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="price-amount">Price ($)</Label>
            <Input
              id="price-amount"
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="price-sale">Sale price (optional)</Label>
            <Input
              id="price-sale"
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              value={salePrice}
              onChange={(e) => setSalePrice(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="price-unit">Unit (optional)</Label>
            <Input
              id="price-unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="e.g. lb, each"
              maxLength={20}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="price-size">Package size (optional)</Label>
            <Input
              id="price-size"
              value={packageSize}
              onChange={(e) => setPackageSize(e.target.value)}
              placeholder="e.g. 12 oz"
              maxLength={40}
            />
          </div>
        </div>

        <Button onClick={submit} disabled={pending}>
          {pending ? "Saving…" : "Add price"}
        </Button>
      </CardContent>
    </Card>
  );
}
