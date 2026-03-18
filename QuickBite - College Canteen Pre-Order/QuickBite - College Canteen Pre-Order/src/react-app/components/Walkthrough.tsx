import React, { useState } from "react";

export default function Walkthrough({ show, onClose }: { show: boolean; onClose: (dontShowAgain?: boolean) => void }) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-lg bg-white dark:bg-slate-800 rounded shadow-lg p-6">
        <h3 className="text-xl font-semibold mb-2">Quick walkthrough</h3>
        <p className="text-sm text-gray-700 mb-4">Three login types are available on this site: Admin, Staff and Student. Here are the essentials:</p>

        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-800 dark:text-slate-200 mb-4">
          <li>
            <strong>Admin login:</strong> Uses predefined admin user ID and admin password (do not change these). Use the top-right admin area to sign in as admin.
          </li>
          <li>
            <strong>Staff login:</strong> There are predefined dev credentials for convenience, but staff can also <em>Register</em>. Staff can place orders at any time.
          </li>
          <li>
            <strong>Student login:</strong> Students may <em>Sign up</em> (register) or use <em>Sign in with Google</em>. Registration stores their login ID and password in Firebase.
          </li>
        </ol>

        <div className="flex items-center justify-between">
          <label className="text-sm text-gray-600 dark:text-slate-300 flex items-center gap-2">
            <input type="checkbox" checked={dontShowAgain} onChange={(e) => setDontShowAgain(e.target.checked)} />
            Don't show again
          </label>

          <div className="flex gap-2">
            <button
              onClick={() => onClose(dontShowAgain)}
              className="px-3 py-1 bg-gray-200 rounded text-sm"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
