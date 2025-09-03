import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get tasks due within 2 days
    const today = new Date();
    const twoDaysFromNow = new Date();
    twoDaysFromNow.setDate(today.getDate() + 2);
    
    const todayString = today.toISOString().split('T')[0];
    const twoDaysString = twoDaysFromNow.toISOString().split('T')[0];

    console.log(`Checking for tasks between ${todayString} and ${twoDaysString}`);

    const { data: upcomingTasks, error } = await supabase
      .from("tasks")
      .select(`
        id,
        title,
        description,
        due_date,
        priority,
        status,
        assigned_to,
        profiles!tasks_assigned_to_fkey (
          email,
          full_name
        ),
        projects (
          name
        )
      `)
      .in("status", ["pending", "in_progress"])
      .gte("due_date", todayString)
      .lte("due_date", twoDaysString)
      .not("assigned_to", "is", null);

    console.log(`Found ${upcomingTasks?.length || 0} upcoming tasks`);
    
    // Also get overdue tasks (due before today and still not completed)
    const { data: overdueTasks, error: overdueError } = await supabase
      .from("tasks")
      .select(`
        id,
        title,
        description,
        due_date,
        priority,
        status,
        assigned_to,
        profiles!tasks_assigned_to_fkey (
          email,
          full_name
        ),
        projects (
          name
        )
      `)
      .in("status", ["pending", "in_progress"])
      .lt("due_date", todayString)
      .not("assigned_to", "is", null);

    console.log(`Found ${overdueTasks?.length || 0} overdue tasks`);

    // Combine both arrays
    const allTasksToNotify = [...(upcomingTasks || []), ...(overdueTasks || [])];

    if (error || overdueError) {
      const errorMsg = error?.message || overdueError?.message || "Unknown error";
      console.error("Error fetching tasks:", errorMsg);
      return new Response(JSON.stringify({ error: errorMsg }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const emailPromises = allTasksToNotify.map(async (task) => {
      const assignee = task.profiles;
      if (!assignee?.email) return null;

      const daysUntilDue = Math.ceil(
        (new Date(task.due_date).getTime() - new Date().getTime()) / (1000 * 3600 * 24)
      );

      const urgencyText = daysUntilDue <= 0 ? "OVERDUE" : `${daysUntilDue} day(s) remaining`;
      const priorityEmoji = task.priority === 'high' ? '🔴' : task.priority === 'medium' ? '🟡' : '🟢';

      try {
        const emailResponse = await resend.emails.send({
          from: "Task Management <notifications@resend.dev>",
          to: [assignee.email],
          subject: `${urgencyText}: ${task.title}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">Task Deadline Reminder ${priorityEmoji}</h2>
              
              <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin: 0 0 10px 0; color: #2563eb;">${task.title}</h3>
                <p style="margin: 5px 0;"><strong>Project:</strong> ${task.projects?.name || 'No Project'}</p>
                <p style="margin: 5px 0;"><strong>Due Date:</strong> ${new Date(task.due_date).toLocaleDateString()}</p>
                <p style="margin: 5px 0;"><strong>Priority:</strong> ${task.priority.toUpperCase()}</p>
                <p style="margin: 5px 0;"><strong>Status:</strong> ${urgencyText}</p>
              </div>

              ${task.description ? `
                <div style="margin: 20px 0;">
                  <h4 style="color: #374151;">Description:</h4>
                  <p style="color: #6b7280;">${task.description}</p>
                </div>
              ` : ''}

              <div style="margin: 30px 0; padding: 15px; background: ${daysUntilDue <= 0 ? '#fee2e2' : '#fef3c7'}; border-radius: 8px;">
                <p style="margin: 0; font-weight: bold; color: ${daysUntilDue <= 0 ? '#dc2626' : '#d97706'};">
                  ${daysUntilDue <= 0 ? 
                    '⚠️ This task is overdue! Please update your progress immediately.' : 
                    `⏰ This task is due soon. Please ensure you're on track to complete it.`
                  }
                </p>
              </div>

              <p style="color: #6b7280; font-size: 14px;">
                Log in to your dashboard to update the task status and manage your workload.
              </p>
            </div>
          `,
        });

        // Create notification record
        await supabase.from("notifications").insert({
          user_id: task.assigned_to,
          type: "deadline_reminder",
          title: `Task due ${urgencyText}: ${task.title}`,
          message: `Your task "${task.title}" is due on ${new Date(task.due_date).toLocaleDateString()}`,
          task_id: task.id,
          sent_at: new Date().toISOString(),
        });

        console.log(`Email sent to ${assignee.email} for task: ${task.title}`);
        return emailResponse;
      } catch (emailError) {
        console.error(`Failed to send email to ${assignee.email}:`, emailError);
        return null;
      }
    });

    const results = await Promise.allSettled(emailPromises);
    const successCount = results.filter(r => r.status === 'fulfilled' && r.value !== null).length;

    console.log(`Deadline notifications sent: ${successCount}/${allTasksToNotify.length} emails`);

    return new Response(
      JSON.stringify({
        message: `Sent ${successCount} deadline notifications`,
        totalTasks: allTasksToNotify.length,
        upcomingTasks: upcomingTasks?.length || 0,
        overdueTasks: overdueTasks?.length || 0,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in deadline-notifications function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);