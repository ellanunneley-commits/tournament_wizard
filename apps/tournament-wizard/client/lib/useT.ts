import { useParams } from "react-router-dom";

// The tournament the page belongs to: its id, the API path for it and page links inside it.
export function useT() {
	const { tid } = useParams();
	return {
		tid: String(tid),
		api: (path: string) => `/app-api/t/${tid}${path}`,
		to: (path: string) => `/t/${tid}${path}`,
	};
}
