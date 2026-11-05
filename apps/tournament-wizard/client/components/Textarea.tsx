import React from "react";
import { cn } from "../lib/cn";
import { fieldClass } from "./Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
	return <textarea ref={ref} rows={3} className={cn(fieldClass, "py-2", className)} {...rest} />;
});
