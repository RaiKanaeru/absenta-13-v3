#!/bin/bash
# ========================================
# ABSENTA 13 - Docker Helper Script
# ========================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}   ABSENTA 13 - Docker Management${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Check if .env exists
check_env() {
    if [ ! -f .env ]; then
        print_warning ".env file not found!"
        echo "Creating .env from template..."
        cp .env.docker.example .env
        print_warning "Please edit .env file and set your passwords!"
        exit 1
    fi
}

# Commands
case "$1" in
    # ==========================================
    # START - Build and start all containers
    # ==========================================
    start)
        print_header
        check_env
        echo "Starting ABSENTA 13..."
        docker-compose up -d --build
        print_success "All containers started!"
        echo ""
        echo "Services:"
        echo "  - App:     http://localhost:3001"
        echo "  - Nginx:   http://localhost:80"
        echo ""
        docker-compose ps
        ;;

    # ==========================================
    # STOP - Stop all containers
    # ==========================================
    stop)
        print_header
        echo "Stopping ABSENTA 13..."
        docker-compose down
        print_success "All containers stopped!"
        ;;

    # ==========================================
    # RESTART - Restart all containers
    # ==========================================
    restart)
        print_header
        echo "Restarting ABSENTA 13..."
        docker-compose restart
        print_success "All containers restarted!"
        ;;

    # ==========================================
    # REBUILD - Rebuild and restart app only
    # ==========================================
    rebuild)
        print_header
        check_env
        echo "Rebuilding application..."
        docker-compose up -d --build absenta-app
        print_success "Application rebuilt!"
        ;;

    # ==========================================
    # LOGS - View container logs
    # ==========================================
    logs)
        docker-compose logs -f ${2:-absenta-app}
        ;;

    # ==========================================
    # STATUS - Show container status
    # ==========================================
    status)
        print_header
        docker-compose ps
        echo ""
        echo "Resource Usage:"
        docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"
        ;;

    # ==========================================
    # SHELL - Enter container shell
    # ==========================================
    shell)
        container=${2:-absenta-app}
        echo "Entering $container shell..."
        docker-compose exec $container sh
        ;;

    # ==========================================
    # DB - Database commands
    # ==========================================
    db)
        case "$2" in
            shell)
                echo "Entering MySQL shell..."
                docker-compose exec mysql mysql -u absenta -p absenta13
                ;;
            backup)
                filename="backup_$(date +%Y%m%d_%H%M%S).sql"
                echo "Creating database backup: $filename"
                docker-compose exec mysql mysqldump -u root -p absenta13 > "./backups/$filename"
                print_success "Backup created: backups/$filename"
                ;;
            restore)
                if [ -z "$3" ]; then
                    print_error "Usage: ./docker.sh db restore <backup_file>"
                    exit 1
                fi
                echo "Restoring database from: $3"
                docker-compose exec -T mysql mysql -u root -p absenta13 < "$3"
                print_success "Database restored!"
                ;;
            *)
                echo "Database commands:"
                echo "  ./docker.sh db shell   - Enter MySQL shell"
                echo "  ./docker.sh db backup  - Create database backup"
                echo "  ./docker.sh db restore <file> - Restore from backup"
                ;;
        esac
        ;;

    # ==========================================
    # TOOLS - Start admin tools (Adminer, Redis Commander)
    # ==========================================
    tools)
        print_header
        echo "Starting admin tools..."
        docker-compose --profile tools up -d
        print_success "Admin tools started!"
        echo ""
        echo "Tools:"
        echo "  - Adminer (DB):     http://localhost:8080"
        echo "  - Redis Commander:  http://localhost:8081"
        ;;

    # ==========================================
    # CLEAN - Remove all containers and volumes
    # ==========================================
    clean)
        print_header
        print_warning "This will remove all containers, networks, and volumes!"
        read -p "Are you sure? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            docker-compose down -v --remove-orphans
            docker system prune -f
            print_success "Cleanup complete!"
        else
            echo "Cancelled."
        fi
        ;;

    # ==========================================
    # UPDATE - Pull latest code and rebuild
    # ==========================================
    update)
        print_header
        echo "Pulling latest code..."
        git pull origin main
        echo "Rebuilding containers..."
        docker-compose up -d --build
        print_success "Update complete!"
        ;;

    # ==========================================
    # HEALTH - Check container health
    # ==========================================
    health)
        print_header
        echo "Checking container health..."
        echo ""
        
        # Check each service
        for service in nginx absenta-app mysql redis; do
            status=$(docker-compose ps -q $service 2>/dev/null)
            if [ -n "$status" ]; then
                health=$(docker inspect --format='{{.State.Health.Status}}' absenta13-${service/absenta-/} 2>/dev/null || echo "no healthcheck")
                if [ "$health" == "healthy" ]; then
                    print_success "$service: $health"
                elif [ "$health" == "no healthcheck" ]; then
                    echo -e "  $service: running (no healthcheck)"
                else
                    print_warning "$service: $health"
                fi
            else
                print_error "$service: not running"
            fi
        done
        ;;

    # ==========================================
    # HELP - Show help
    # ==========================================
    *)
        print_header
        echo ""
        echo "Usage: ./docker.sh <command>"
        echo ""
        echo "Commands:"
        echo "  start     - Build and start all containers"
        echo "  stop      - Stop all containers"
        echo "  restart   - Restart all containers"
        echo "  rebuild   - Rebuild and restart app only"
        echo "  logs      - View container logs (default: app)"
        echo "  status    - Show container status"
        echo "  shell     - Enter container shell"
        echo "  db        - Database commands (shell, backup, restore)"
        echo "  tools     - Start admin tools (Adminer, Redis Commander)"
        echo "  clean     - Remove all containers and volumes"
        echo "  update    - Pull latest code and rebuild"
        echo "  health    - Check container health"
        echo ""
        echo "Examples:"
        echo "  ./docker.sh start"
        echo "  ./docker.sh logs mysql"
        echo "  ./docker.sh shell absenta-app"
        echo "  ./docker.sh db backup"
        ;;
esac
