"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";

export function LoginForm({
  action = "/api/auth/login",
  hasError,
  identifier = "email",
}: {
  action?: string;
  hasError: boolean;
  identifier?: "email" | "username";
}) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={action} className="login-form" method="post">
      {hasError ? (
        <p className="form-error" role="alert">
          The {identifier === "username" ? "username" : "email address"} or
          password was not recognised.
        </p>
      ) : null}
      <label htmlFor={identifier}>
        {identifier === "username" ? "Username" : "Email address"}
      </label>
      <input
        autoCapitalize={identifier === "username" ? "none" : undefined}
        autoComplete={identifier}
        id={identifier}
        name={identifier}
        placeholder={
          identifier === "username" ? "Enter your username" : "you@company.com"
        }
        required
        type={identifier === "email" ? "email" : "text"}
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
