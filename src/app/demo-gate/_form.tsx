"use client"

import { useActionState } from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  submitDemoGate,
  type DemoGateActionState,
} from "@/app/demo-gate/actions"

const initialState: DemoGateActionState = {}

export function DemoGateForm({ next }: { next: string }): JSX.Element {
  const [state, formAction, pending] = useActionState(
    submitDemoGate,
    initialState,
  )

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="passcode">Demo passcode</Label>
        <Input
          id="passcode"
          name="passcode"
          type="password"
          autoComplete="off"
          required
          disabled={pending}
          autoFocus
        />
      </div>
      {state.error && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Checking..." : "Continue"}
      </Button>
    </form>
  )
}
