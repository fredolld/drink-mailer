import { SHEETS, readTable } from "./sheets";

export type Recipient = {
  name: string;
  email: string;
  active: boolean;
  dept: string;
  phone: string;
  note: string;
  /** Recipients 表的「你訂暱稱」欄 */
  nickname: string;
};

const PRIORITY_DEPT = "資訊中心";

export async function loadRecipients(): Promise<Recipient[]> {
  const rows = await readTable(SHEETS.recipients);
  const list = rows
    .filter((r) => r["Email"])
    .map((r) => ({
      name: r["Name"] || "",
      email: r["Email"] || "",
      active: (r["Active"] || "").toLowerCase() === "true",
      dept: r["Dept"] || "",
      phone: r["Phone"] || "",
      note: r["Note"] || "",
      nickname: r["你訂暱稱"] || "",
    }));

  // 資訊中心排最前面，其餘依部門名稱排序
  list.sort((a, b) => {
    if (a.dept === PRIORITY_DEPT && b.dept !== PRIORITY_DEPT) return -1;
    if (a.dept !== PRIORITY_DEPT && b.dept === PRIORITY_DEPT) return 1;
    return a.dept.localeCompare(b.dept);
  });
  return list;
}
