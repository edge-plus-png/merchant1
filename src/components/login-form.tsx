"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";

export function LoginForm({
  action = "/api/auth/login",
  hasError,
}: {
  action?: string;
  hasError: boolean;
}) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={action} className="login-form" method="post">
      {hasError ? (
        <p className="form-error" role="alert">
          The email address or password was not recognised.
        </p>
      ) : null}
      <label htmlFor="email">Email address</label>
      <input
        autoComplete="email"
        id="email"
        name="email"
        placeholder="you@company.com"
        required
        type="email"
      />
      <label htmlFor="password">Password</label>
      <div className="password-input">
        <input
          autoComplete="current-password"
          id="password"
          name="password"
          placeholder="Enter your password"
          required
          type={showPassword ? "text" : "password"}
        />
        <button
          aria-label={showPassword ? "Hide password" : "Show password"}
          onClick={() => setShowPassword((value) => !value)}
          type="button"
        >
          <Icon name={showPassword ? "eyeOff" : "eye"} />
        </button>
      </div>
      <button className="primary-button" type="submit">
        Sign in
      </button>
    </form>
  );
}
