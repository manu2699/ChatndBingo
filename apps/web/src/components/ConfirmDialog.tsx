import { useEffect, useRef } from "react";

interface Props {
	open: boolean;
	title: string;
	confirmLabel: string;
	cancelLabel?: string;
	onConfirm: () => void;
	onCancel: () => void;
}

export function ConfirmDialog({ open, title, confirmLabel, cancelLabel = "Stay", onConfirm, onCancel }: Props) {
	const ref = useRef<HTMLDialogElement>(null);

	useEffect(() => {
		const d = ref.current;
		if (!d) return;
		if (open && !d.open) d.showModal();
		if (!open && d.open) d.close();
	}, [open]);

	return (
		<dialog ref={ref} className="dialog" onCancel={(e) => (e.preventDefault(), onCancel())} onClick={(e) => e.target === ref.current && onCancel()}>
			<div className="dialog__body">
				<h2>{title}</h2>
				<div className="dialog__actions">
					<button type="button" className="btn btn--ghost" onClick={onCancel} autoFocus>
						{cancelLabel}
					</button>
					<button type="button" className="btn btn--danger" onClick={onConfirm}>
						{confirmLabel}
					</button>
				</div>
			</div>
		</dialog>
	);
}
