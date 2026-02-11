---
name: absenta-frontend
description: Frontend development skill for Absenta 13 v3. Use this when working on React components, pages, or frontend logic. Triggers on tasks involving src/, React components, Tailwind styling, or Shadcn UI.
license: MIT
metadata:
  author: absenta-team
  version: "1.0.0"
---

# Absenta Frontend Development Skill

Guidelines for frontend development in Absenta 13 v3 school attendance system.

## When to Apply

Reference these guidelines when:
- Creating or modifying React components in `src/`
- Styling with Tailwind CSS
- Using Shadcn UI components
- Implementing data fetching with apiCall
- Writing frontend tests

## Critical Rules

### Absolute Imports
```typescript
// Correct - always use @/ alias
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiCall } from "@/utils/apiClient";

// Incorrect - NEVER use relative paths
import { Button } from "../../components/ui/button"; // FORBIDDEN
```

### Component Structure
```tsx
interface StudentCardProps {
  student: Student;
  onSelect?: (id: string) => void;
}

/**
 * Displays student information in a card format
 */
export function StudentCard({ student, onSelect }: StudentCardProps) {
  const { toast } = useToast();
  
  const handleClick = () => {
    onSelect?.(student.id);
  };
  
  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <CardHeader>
        <CardTitle>{student.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{student.class}</p>
      </CardContent>
    </Card>
  );
}
```

### Data Fetching with apiCall
```typescript
import { apiCall } from "@/utils/apiClient";
import { useToast } from "@/hooks/use-toast";

function StudentList() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    async function fetchStudents() {
      try {
        const response = await apiCall('/api/students');
        setStudents(response.data);
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load students"
        });
      } finally {
        setLoading(false);
      }
    }
    fetchStudents();
  }, [toast]);

  if (loading) return <Skeleton className="h-20 w-full" />;
  
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {students.map(student => (
        <StudentCard key={student.id} student={student} />
      ))}
    </div>
  );
}
```

### Error Handling
```typescript
// NEVER use alert()
alert("Error occurred"); // FORBIDDEN

// Always use toast
toast({
  variant: "destructive",
  title: "Error",
  description: "Something went wrong"
});
```

### Styling with Tailwind
```tsx
// Good - use Tailwind utilities
<div className="flex items-center justify-between p-4 bg-background border rounded-lg">
  <span className="text-sm font-medium">Title</span>
  <Badge variant="secondary">Active</Badge>
</div>

// Avoid inline styles
<div style={{ display: 'flex' }}> // Avoid when possible
```

### Icons with Lucide React
```tsx
import { User, Calendar, CheckCircle } from "lucide-react";

function StatusIcon({ status }: { status: string }) {
  return status === 'present' 
    ? <CheckCircle className="h-4 w-4 text-green-500" />
    : <XCircle className="h-4 w-4 text-red-500" />;
}
```

## File Structure

```
src/
├── components/
│   ├── ui/           # Shadcn UI (DO NOT MODIFY)
│   └── ...           # Custom components
├── pages/            # Route pages
├── hooks/            # Custom hooks
├── utils/            # Helpers (apiClient.ts)
└── types/            # TypeScript types
```

## UI Component Usage

### Button
```tsx
import { Button } from "@/components/ui/button";

<Button variant="default">Primary</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="destructive">Delete</Button>
<Button variant="outline">Cancel</Button>
<Button variant="ghost">Ghost</Button>
```

### Card
```tsx
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";

<Card>
  <CardHeader>
    <CardTitle>Attendance Summary</CardTitle>
  </CardHeader>
  <CardContent>
    <p>Content here</p>
  </CardContent>
  <CardFooter>
    <Button>Submit</Button>
  </CardFooter>
</Card>
```

### Form with Input
```tsx
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

<div className="space-y-2">
  <Label htmlFor="name">Name</Label>
  <Input id="name" placeholder="Enter name" />
</div>
```

## Performance Guidelines

- Use React.memo for expensive list items
- Lazy load routes with React.lazy
- Use useMemo/useCallback for expensive computations
- Avoid inline object/array props that cause re-renders
