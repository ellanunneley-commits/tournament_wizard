import React from "react";
import { Link } from "react-router-dom";
import { Lock, Hourglass } from "lucide-react";
import { EmptyState } from "./EmptyState";
import { Button } from "./Button";
import { PageHeader } from "./PageHeader";
import { useT } from "../lib/useT";

export function LockedScreen({ email, activated }: { email: string | null; activated: boolean }) {
	const { tid } = useT();
	if (!activated) {
		return (
			<div className="space-y-6">
				<PageHeader title="Opening soon" />
				<EmptyState icon={<Hourglass />} title="This tournament isn't open yet" description="The organizers are still setting things up. Check back soon." />
			</div>
		);
	}
	return (
		<div className="space-y-6">
			<PageHeader title="Registered teams only" />
			<EmptyState
				icon={<Lock />}
				title="You're signed in, but not on a team yet"
				description={`Standings, schedule and brackets are for registered teams and the friends and family their captains invite. Ask someone on a team to invite ${email ?? "your email"}, or register your own team.`}
				action={
					<Button variant="primary" asChild>
						<Link to={`/t/${tid}/my-team`}>Register a team</Link>
					</Button>
				}
			/>
		</div>
	);
}
