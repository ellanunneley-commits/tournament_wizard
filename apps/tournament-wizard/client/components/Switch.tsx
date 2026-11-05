import React from "react";
import * as S from "@radix-ui/react-switch";

export function Switch(props: React.ComponentProps<typeof S.Root>) {
	return (
		<S.Root
			className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full bg-line transition-colors data-[state=checked]:bg-primary disabled:cursor-not-allowed disabled:opacity-50"
			{...props}
		>
			<S.Thumb className="block size-5 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[22px]" />
		</S.Root>
	);
}
