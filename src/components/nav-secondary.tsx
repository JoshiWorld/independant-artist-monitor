"use client"

import * as React from "react"
import { IconSearch } from "@tabler/icons-react"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Input } from "./ui/input";

export function NavSecondary({
  setIsSearching,
  setQuery,
  query,
  isSearching,
  ...props
}: {
  setIsSearching: (value: boolean) => void;
  setQuery: (value: string) => void;
  query: string;
  isSearching: boolean;
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {

  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            {isSearching ? (
              <Input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onBlur={() => setIsSearching(false)}
                placeholder="Ad-Account suchen..."
                className="h-8"
              />
            ) : (
                <SidebarMenuButton onClick={() => setIsSearching(true)}>
                  <IconSearch />
                  <span>Ad-Account suchen</span>
                </SidebarMenuButton>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
