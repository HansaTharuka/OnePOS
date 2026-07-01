import { notFound } from "next/navigation";
import { apiGet } from "@/lib/api/server";
import { ApiError } from "@/lib/api/error";
import type { ProductRecord } from "@/lib/queries/products";
import { ProductForm } from "../product-form";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let product: ProductRecord;
  try {
    product = await apiGet<ProductRecord>(`/products/${id}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold tracking-tight text-slate-900">Edit product</h1>
      <ProductForm editing={product} />
    </div>
  );
}
