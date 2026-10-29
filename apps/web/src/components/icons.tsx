import type { SVGProps } from "react";

const base = (p: SVGProps<SVGSVGElement>) => ({
	width: 20,
	height: 20,
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: 2.4,
	strokeLinecap: "round" as const,
	strokeLinejoin: "round" as const,
	"aria-hidden": true,
	...p
});

export const SendIcon = (p: SVGProps<SVGSVGElement>) => (
	<svg {...base(p)}>
		<path d="M22 2 11 13" />
		<path d="M22 2 15 22l-4-9-9-4 20-7Z" />
	</svg>
);
export const CopyIcon = (p: SVGProps<SVGSVGElement>) => (
	<svg {...base(p)}>
		<rect x="9" y="9" width="12" height="12" rx="3" />
		<path d="M5 15V6a3 3 0 0 1 3-3h9" />
	</svg>
);
export const CheckIcon = (p: SVGProps<SVGSVGElement>) => (
	<svg {...base(p)}>
		<path d="m4 12 5 5L20 6" />
	</svg>
);
export const ShuffleIcon = (p: SVGProps<SVGSVGElement>) => (
	<svg {...base(p)}>
		<path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
	</svg>
);
export const LeaveIcon = (p: SVGProps<SVGSVGElement>) => (
	<svg {...base(p)}>
		<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
	</svg>
);
export const ShareIcon = (p: SVGProps<SVGSVGElement>) => (
	<svg {...base(p)}>
		<circle cx="18" cy="5" r="3" />
		<circle cx="6" cy="12" r="3" />
		<circle cx="18" cy="19" r="3" />
		<path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
	</svg>
);
export const CrownIcon = (p: SVGProps<SVGSVGElement>) => (
	<svg {...base({ strokeWidth: 2, ...p })}>
		<path d="m3 8 4.5 4L12 5l4.5 7L21 8l-2 11H5L3 8Z" />
	</svg>
);
export const SoundOnIcon = (p: SVGProps<SVGSVGElement>) => (
	<svg {...base(p)}>
		<path d="M11 5 6 9H2v6h4l5 4V5Z" />
		<path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
	</svg>
);
export const SoundOffIcon = (p: SVGProps<SVGSVGElement>) => (
	<svg {...base(p)}>
		<path d="M11 5 6 9H2v6h4l5 4V5Z" />
		<path d="m22 9-6 6M16 9l6 6" />
	</svg>
);
export const PlusIcon = (p: SVGProps<SVGSVGElement>) => (
	<svg {...base(p)}>
		<path d="M12 5v14M5 12h14" />
	</svg>
);
export const MinusIcon = (p: SVGProps<SVGSVGElement>) => (
	<svg {...base(p)}>
		<path d="M5 12h14" />
	</svg>
);
