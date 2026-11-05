import React from "react";
import { Toaster as Sonner, toast } from "sonner";

export { toast };
export const Toaster = () => <Sonner position="top-center" richColors closeButton />;
