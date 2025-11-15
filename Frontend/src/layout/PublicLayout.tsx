import Navbar from "../components/Navbar";
import { Outlet } from "react-router-dom";
import { DottedGlowBackground } from "../components/ui/Dotted-background";

export default function PublicLayout() {
  return (
    <>
      <Navbar />
      <DottedGlowBackground className='opacity-90 absolute -z-1' glowColor='#e8ff53' darkColor='#DDFF00' />
      <div className="">
        <Outlet />

      </div>
    </>
  );
}
