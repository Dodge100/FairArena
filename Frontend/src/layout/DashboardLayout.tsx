import { Outlet } from "react-router-dom";

export default function DashboardLayout() {
  return (
    <div className="min-h-screen">
      {/* You can add a dashboard sidebar/header later */}
      <Outlet />
    </div>
  );
}
