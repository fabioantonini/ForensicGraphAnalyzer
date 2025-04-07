import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Upload, Link } from "lucide-react";

export function TestTabs() {
  return (
    <div className="p-4 border rounded-md">
      <h2 className="text-lg font-bold mb-4">Test Tabs Component</h2>
      <Tabs defaultValue="tab1" className="w-full">
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="tab1">
            <Upload className="h-4 w-4 mr-2" />
            Tab 1
          </TabsTrigger>
          <TabsTrigger value="tab2">
            <Link className="h-4 w-4 mr-2" />
            Tab 2
          </TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">
          <div className="p-4 bg-gray-100 rounded-md">
            <p>This is the content for Tab 1</p>
            <Button className="mt-2">Tab 1 Button</Button>
          </div>
        </TabsContent>
        <TabsContent value="tab2">
          <div className="p-4 bg-gray-100 rounded-md">
            <p>This is the content for Tab 2</p>
            <Button className="mt-2">Tab 2 Button</Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}