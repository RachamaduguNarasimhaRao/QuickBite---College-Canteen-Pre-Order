import React from "react";

export default function LandingCards({ onSelect }: { onSelect: (r: "student" | "staff" | "admin") => void }) {
  const cards = [
    {
      title: "Student Login",
      img: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?q=80&w=1200&auto=format&fit=crop&ixlib=rb-4.0.3&s=3a0a0d6cb65b6f7f4487ef8a2f7b3a8a",
      id: "student",
    },
    {
      title: "Staff Login",
      img: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=1200&auto=format&fit=crop&ixlib=rb-4.0.3&s=bbff6e48710fbe2c97f8d1f3a8e6b3d5",
      id: "staff",
    },
    {
      title: "Admin Login",
      img: "https://images.unsplash.com/photo-1526318472351-c75fcf070e9e?q=80&w=1200&auto=format&fit=crop&ixlib=rb-4.0.3&s=7b1c3e9349a1d9d34e2b9d5b1cf4b6a2",
      id: "admin",
    },
  ];

  return (
    <section className="relative w-full h-80 rounded-lg overflow-hidden">
      {/* Blurred background */}
      <div
        className="absolute inset-0 bg-cover bg-center filter blur-md scale-105"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?q=80&w=1600&auto=format&fit=crop&ixlib=rb-4.0.3&s=7b0e5c2b2bbf4ea7b4aa7b8b0d6b0f9d')`,
        }}
        aria-hidden
      />

      <div className="absolute inset-0 bg-black/40" aria-hidden />

      <div className="relative z-10 h-full flex items-center justify-center px-4">
        <div className="flex gap-4">
          {cards.map((c) => (
            <button
              key={c.id}
              onClick={() => onSelect(c.id as any)}
              className="w-40 h-56 rounded-2xl overflow-hidden relative shadow-lg transform transition hover:scale-105 focus:scale-105 focus:outline-none ring-0 bg-white dark:bg-slate-800/5"
            >
              <img src={c.img} alt="" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/65 to-transparent" />

              <div className="absolute left-4 bottom-4 text-left text-white">
                <h3 className="text-base sm:text-lg font-semibold leading-tight">{c.title}</h3>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
