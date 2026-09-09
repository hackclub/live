export type ReferralRow = {
  id: string;
  referrerFirstName: string;
  referrerHandle: string;
  refereeFirstName: string;
  refereeHandle: string;
  status: string;
  redemptionId: string | null;
};

function badgeClass(status: string) {
  if (status === "paid") return "badge badge-success";
  if (status === "void") return "badge badge-error";
  return "badge badge-ghost";
}

export default function ReferralsTable({ rows }: { rows: ReferralRow[] }) {
  if (rows.length === 0) {
    return <p className="opacity-60 text-sm">No referrals yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            <th>Referrer</th>
            <th>Referee</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} id={row.id}>
              <td>
                {row.referrerFirstName || "?"}{" "}
                {row.referrerHandle && <span className="opacity-60">@{row.referrerHandle}</span>}
              </td>
              <td>
                {row.refereeFirstName || "?"}{" "}
                {row.refereeHandle && <span className="opacity-60">@{row.refereeHandle}</span>}
              </td>
              <td>
                <span className={badgeClass(row.status)}>{row.status}</span>
              </td>
              <td className="text-right">
                {row.redemptionId && (
                  <a href={`/admin/purchases#${row.redemptionId}`} className="link text-xs opacity-70">
                    purchase →
                  </a>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
